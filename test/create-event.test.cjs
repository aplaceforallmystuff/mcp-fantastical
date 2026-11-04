const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

async function createEvent(args) {
  const handlers = new Map();
  const commands = [];
  class Server {
    setRequestHandler(schema, handler) { handlers.set(schema, handler); }
    async connect() {}
  }
  const source = readFileSync(resolve(__dirname, '../src/index.ts'), 'utf8')
    .replace('import.meta.url', '"file:///test/dist/index.js"');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = {
    exports: {}, URLSearchParams,
    process: { platform: 'darwin', exit: () => assert.fail('server exited') },
    console: { error() {} },
    require(name) {
      if (name.endsWith('/server/index.js')) return { Server };
      if (name.endsWith('/server/stdio.js')) return { StdioServerTransport: class {} };
      if (name.endsWith('/types.js')) return { CallToolRequestSchema: 'call', ListToolsRequestSchema: 'list' };
      if (name === 'util') return { promisify: () => async (command) => {
        commands.push(command);
        return { stdout: '', stderr: '' };
      } };
      return require(name);
    },
  };
  vm.runInNewContext(compiled, context);
  const result = await handlers.get('call')({ params: { name: 'fantastical_create_event', arguments: args } });
  assert.equal(result.isError, undefined);
  const url = commands[0].match(/x-fantastical3:\/\/parse\?[^'"\\]+/)[0];
  return { url, result: JSON.parse(result.content[0].text) };
}

test('event sentence, calendar and notes use percent-encoded spaces', async () => {
  const { url, result } = await createEvent({
    sentence: 'Lunch with Sarah tomorrow at noon', calendar: 'My Work', notes: 'Bring notes',
  });
  assert.ok(url.includes('s=Lunch%20with%20Sarah%20tomorrow%20at%20noon'));
  assert.ok(url.includes('calendarName=My%20Work'));
  assert.ok(url.includes('n=Bring%20notes'));
  assert.ok(url.includes('add=1'));
  assert.ok(!url.includes('+'));
  assert.equal(result.success, true);
});

test('literal plus signs, Unicode and reserved characters survive URL encoding', async () => {
  const sentence = 'C++ café & planning #1 tomorrow';
  const { url } = await createEvent({ sentence, addImmediately: false });
  assert.ok(url.includes('C%2B%2B%20caf%C3%A9%20%26%20planning%20%231'));
  const params = new URL(url).searchParams;
  assert.equal(params.get('s'), sentence);
  assert.equal(params.has('add'), false);
});
