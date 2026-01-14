# CLAUDE.md - mcp-fantastical

MCP server for Fantastical calendar app - create events and manage schedules.

## Tech Stack
- **Language:** TypeScript
- **Runtime:** Node.js (ES modules)
- **Protocol:** Model Context Protocol (MCP)

## Architecture
```
src/
├── index.ts          # Server entry, tool registration
└── tools/
    ├── events.ts     # Event creation via URL scheme
    └── calendar.ts   # Calendar queries via AppleScript
```

## Integration Method
Uses Fantastical's URL scheme (`x-fantastical3://`) for event creation and AppleScript for calendar queries. No API key needed - works with local Fantastical installation.

## Development
```bash
npm run build    # Compile TypeScript
npm run watch    # Watch mode
```

## Constraints
```yaml
rules:
  - id: macos-only
    description: Requires macOS with Fantastical installed
  - id: url-encoding
    description: Event details must be URL-encoded
  - id: natural-language
    description: Fantastical parses natural language dates
```
