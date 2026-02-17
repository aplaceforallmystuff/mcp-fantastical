# MCP Fantastical Server

[![npm version](https://img.shields.io/npm/v/mcp-fantastical.svg)](https://www.npmjs.com/package/mcp-fantastical)
[![CI](https://github.com/aplaceforallmystuff/mcp-fantastical/actions/workflows/ci.yml/badge.svg)](https://github.com/aplaceforallmystuff/mcp-fantastical/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.io)

MCP server for [Fantastical](https://flexibits.com/fantastical) - the powerful calendar app for macOS.

## Why Use This?

- **Natural language event creation** - Use Fantastical's powerful natural language parsing ("Meeting with John tomorrow at 3pm")
- **View your schedule** - Check today's events or upcoming appointments without leaving your conversation
- **Quick calendar access** - Jump to any date in Fantastical instantly
- **Calendar-aware AI** - Let Claude understand your availability and schedule context
- **Zero configuration** - Works with your existing Fantastical and Calendar setup

## Features

| Category | Capabilities |
|----------|-------------|
| **Event Creation** | Create events using natural language, specify calendar, add notes |
| **Schedule Viewing** | View today's events, upcoming events for any number of days |
| **Navigation** | Open Fantastical to specific dates |
| **Search** | Search events by title, location, or notes |
| **Calendar Management** | List all available calendars |

## Prerequisites

- macOS (Fantastical is macOS-only)
- Node.js 18+
- [Fantastical](https://flexibits.com/fantastical) installed
- Calendar access permissions for Terminal/Claude

## Installation

### Using npm (Recommended)

```bash
npx mcp-fantastical
```

### From Source

```bash
git clone https://github.com/aplaceforallmystuff/mcp-fantastical.git
cd mcp-fantastical
npm install
npm run build
```

## Configuration

No API keys required - this server uses AppleScript to communicate with Fantastical and the Calendar app.

### For Claude Desktop

Add to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "fantastical": {
      "command": "npx",
      "args": ["-y", "mcp-fantastical"]
    }
  }
}
```

### For Claude Code

Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "fantastical": {
      "command": "npx",
      "args": ["-y", "mcp-fantastical"]
    }
  }
}
```

### Permissions

On first run, you may need to grant accessibility permissions:
1. System Preferences → Privacy & Security → Accessibility
2. Add Terminal (or your terminal app) to the allowed list

## Usage Examples

### Creating Events
- "Schedule a meeting with the team tomorrow at 2pm"
- "Add dentist appointment Friday at 10am to my Personal calendar"
- "Create a recurring standup every Monday at 9am"
- "Block off next Tuesday afternoon for deep work"

### Viewing Schedule
- "What's on my calendar today?"
- "Show me my schedule for the next week"
- "What meetings do I have tomorrow?"
- "Am I free on Friday afternoon?"

### Navigation
- "Open my calendar to next Monday"
- "Show me December 25th in Fantastical"
- "Jump to next week in my calendar"

### Searching
- "Find all meetings with Sarah"
- "Search for dentist appointments"
- "Look up project review meetings"

## Available Tools

| Tool | Description |
|------|-------------|
| `fantastical_create_event` | Create an event using natural language parsing |
| `fantastical_get_today` | Get today's calendar events |
| `fantastical_get_upcoming` | Get upcoming events for specified number of days |
| `fantastical_show_date` | Open Fantastical to a specific date |
| `fantastical_get_calendars` | List all available calendars |
| `fantastical_search` | Search for events by query |

## Development

```bash
# Watch mode for development
npm run watch

# Build TypeScript
npm run build

# Run locally
node dist/index.js
```

## Troubleshooting

### "AppleScript error: Not authorized to send Apple events"
Grant accessibility permissions:
1. Open System Preferences → Privacy & Security → Accessibility
2. Click the lock to make changes
3. Add Terminal (or your terminal app) and enable it

### "Error: This MCP server only works on macOS"
This server requires macOS because Fantastical is a macOS application. It uses AppleScript to communicate with Fantastical and the Calendar app.

### Events not showing up
- Ensure Fantastical is syncing with iCloud/Calendar
- Check that Calendar.app has access to the same calendars
- Verify the event was created in the correct calendar

### Fantastical not opening
- Ensure Fantastical is installed
- Try opening Fantastical manually first
- Check that URL schemes are enabled in Fantastical preferences

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT - see [LICENSE](LICENSE) for details.

## Links

- [Fantastical](https://flexibits.com/fantastical) - Official Fantastical website
- [Model Context Protocol](https://modelcontextprotocol.io) - MCP specification
- [GitHub Repository](https://github.com/aplaceforallmystuff/mcp-fantastical)
