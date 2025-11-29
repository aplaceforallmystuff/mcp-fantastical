# Contributing to MCP Fantastical

Thank you for your interest in contributing to MCP Fantastical! This document provides guidelines and instructions for contributing.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/mcp-fantastical.git
   cd mcp-fantastical
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development

### Watch Mode

For active development with auto-recompilation:

```bash
npm run watch
```

### Building

Compile TypeScript to JavaScript:

```bash
npm run build
```

### Running Locally

Test your changes locally:

```bash
node dist/index.js
```

## Adding New Tools

When adding new calendar tools, follow this pattern in `src/index.ts`:

1. Add the tool definition to the `TOOLS` array:

```typescript
{
  name: "fantastical_your_tool",
  description: "Description of what the tool does",
  inputSchema: {
    type: "object" as const,
    properties: {
      param: {
        type: "string",
        description: "Parameter description",
      },
    },
    required: ["param"],
  },
},
```

2. Add the handler in the switch statement:

```typescript
case "fantastical_your_tool": {
  const { param } = args as { param: string };

  // Use AppleScript or URL scheme
  const script = `tell application "Fantastical" to ...`;
  const result = await runAppleScript(script);

  return {
    content: [{
      type: "text",
      text: JSON.stringify({ success: true, result }, null, 2),
    }],
  };
}
```

## Code Style

- Use TypeScript for all new code
- Follow existing code formatting patterns
- Add appropriate error handling
- Use descriptive variable names
- Keep functions focused and single-purpose

## Submitting Changes

1. **Commit your changes** with a clear message:
   ```bash
   git commit -m "Add feature: description of your changes"
   ```

2. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Open a Pull Request** on GitHub with:
   - Clear description of the changes
   - Any relevant issue numbers
   - Screenshots if applicable

## Reporting Issues

When reporting issues, please include:

- macOS version
- Node.js version
- Fantastical version
- Steps to reproduce the issue
- Expected vs actual behavior
- Any error messages

## Questions?

Feel free to open an issue for any questions about contributing.
