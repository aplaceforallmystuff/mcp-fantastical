#!/usr/bin/env node
/**
 * MCP Server for Fantastical Calendar
 *
 * Provides calendar management through Fantastical's AppleScript interface.
 * Leverages Fantastical's powerful natural language parsing for event creation.
 *
 * Requirements:
 * - macOS only
 * - Fantastical installed
 * - For reading events: macOS Calendar app automation permissions
 *   (System Settings → Privacy & Security → Automation → [your terminal/app] → Calendar)
 *
 * Note: Event creation uses Fantastical's URL scheme and doesn't require Calendar permissions.
 * Reading events (get_today, get_upcoming, get_calendars) uses the macOS Calendar app
 * since Fantastical's AppleScript interface doesn't support querying events.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Error codes
const CALENDAR_PERMISSION_ERROR = -1743;

// Helper to check if error is a Calendar permission error
function isCalendarPermissionError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('-1743') ||
           error.message.includes('Not authorised to send Apple events to Calendar');
  }
  return false;
}

// User-friendly error message for Calendar permission issues
const CALENDAR_PERMISSION_MESSAGE = `Calendar app permission denied.

This tool reads events from the macOS Calendar app (which Fantastical syncs with).
To fix this, grant Calendar automation permission:

1. Open System Settings → Privacy & Security → Automation
2. Find the app running this MCP server (e.g., Terminal, iTerm, VS Code, or Node)
3. Enable the "Calendar" toggle

Note: If running in a subprocess (like Claude Code), you may need to grant permission
to the parent application or the Node.js process itself.

As a workaround, I can open Fantastical to show your calendar instead.`;

// Helper to run AppleScript
async function runAppleScript(script: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
    if (stderr && !stdout) {
      throw new Error(stderr);
    }
    return stdout.trim();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`AppleScript error: ${error.message}`);
    }
    throw error;
  }
}

// Helper to run multi-line AppleScript
async function runAppleScriptMultiline(script: string): Promise<string> {
  try {
    // Write script to temp file and execute
    const escapedScript = script.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const { stdout, stderr } = await execAsync(`osascript -e "${escapedScript}"`);
    if (stderr && !stdout) {
      throw new Error(stderr);
    }
    return stdout.trim();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`AppleScript error: ${error.message}`);
    }
    throw error;
  }
}

// Helper to open Fantastical via URL scheme
// Note: Do NOT use AppleScript `parse sentence` for navigation - it types into the event
// creation dialog instead of navigating. URL schemes are the correct approach.
async function openFantasticalUrl(url: string): Promise<void> {
  await execAsync(`open "${url}"`);
}

// Check if Fantastical is installed
async function checkFantasticalInstalled(): Promise<boolean> {
  try {
    await runAppleScript('tell application "System Events" to return exists (processes where name is "Fantastical")');
    return true;
  } catch {
    return false;
  }
}

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: "fantastical_create_event",
    description: "Create a calendar event using Fantastical's natural language parsing. Examples: 'Meeting with John tomorrow at 3pm', 'Dentist appointment Friday 10am', 'Call with team every Monday at 9am'",
    inputSchema: {
      type: "object" as const,
      properties: {
        sentence: {
          type: "string",
          description: "Natural language description of the event (e.g., 'Lunch with Sarah tomorrow at noon')",
        },
        calendar: {
          type: "string",
          description: "Optional: Target calendar name (e.g., 'Work', 'Personal')",
        },
        notes: {
          type: "string",
          description: "Optional: Additional notes for the event",
        },
        addImmediately: {
          type: "boolean",
          description: "Add immediately without showing Fantastical UI (default: true)",
        },
      },
      required: ["sentence"],
    },
  },
  {
    name: "fantastical_get_today",
    description: "Get today's calendar events. Note: Reads from macOS Calendar app (synced with Fantastical). Requires Calendar automation permission.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "fantastical_get_upcoming",
    description: "Get upcoming calendar events. Note: Reads from macOS Calendar app (synced with Fantastical). Requires Calendar automation permission.",
    inputSchema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number",
          description: "Number of days to look ahead (default: 7)",
        },
      },
      required: [],
    },
  },
  {
    name: "fantastical_show_date",
    description: "Open Fantastical and navigate to a specific date",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description: "Date to show (e.g., '2025-01-15', 'tomorrow', 'next monday')",
        },
      },
      required: ["date"],
    },
  },
  {
    name: "fantastical_get_calendars",
    description: "List all available calendars. Note: Reads from macOS Calendar app (synced with Fantastical). Requires Calendar automation permission.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "fantastical_search",
    description: "Search for events by text in Fantastical",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query (event title, location, or notes)",
        },
      },
      required: ["query"],
    },
  },
];

// Create server instance
const server = new Server(
  {
    name: "mcp-fantastical",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "fantastical_create_event": {
        const { sentence, calendar, notes, addImmediately = true } = args as {
          sentence: string;
          calendar?: string;
          notes?: string;
          addImmediately?: boolean;
        };

        // Build URL with parameters
        const params = new URLSearchParams();
        params.append("s", sentence);
        if (addImmediately) {
          params.append("add", "1");
        }
        if (calendar) {
          params.append("calendarName", calendar);
        }
        if (notes) {
          params.append("n", notes);
        }

        const url = `x-fantastical3://parse?${params.toString()}`;
        await openFantasticalUrl(url);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Event created: "${sentence}"`,
              calendar: calendar || "default",
              addedImmediately: addImmediately,
            }, null, 2),
          }],
        };
      }

      case "fantastical_get_today": {
        // Get events using Calendar app (Fantastical syncs with it)
        // Use current date as reference to avoid locale parsing issues
        const script = `
set output to ""
set todayStart to current date
set hours of todayStart to 0
set minutes of todayStart to 0
set seconds of todayStart to 0
set todayEnd to todayStart + (1 * days)

tell application "Calendar"
  repeat with cal in calendars
    set calName to name of cal
    try
      set calEvents to (every event of cal whose start date >= todayStart and start date < todayEnd)
      repeat with evt in calEvents
        set evtTitle to summary of evt
        set evtStart to start date of evt
        set evtEnd to end date of evt
        set evtLoc to location of evt
        set output to output & calName & "|" & evtTitle & "|" & (evtStart as string) & "|" & (evtEnd as string) & "|" & evtLoc & "\\n"
      end repeat
    end try
  end repeat
end tell
return output`;

        try {
          const result = await runAppleScriptMultiline(script);
          const events = result
            .split("\n")
            .filter(line => line.trim())
            .map(line => {
              const [calendar, title, start, end, location] = line.split("|");
              return { calendar, title, start, end, location: location || "" };
            })
            .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                date: new Date().toISOString().split("T")[0],
                count: events.length,
                events,
              }, null, 2),
            }],
          };
        } catch (error) {
          if (isCalendarPermissionError(error)) {
            // Offer to open Fantastical as a fallback (use URL scheme, not parse sentence)
            await openFantasticalUrl('x-fantastical3://show/calendar/today');
            return {
              content: [{
                type: "text",
                text: CALENDAR_PERMISSION_MESSAGE + "\n\nFallback: Opened Fantastical to today's view.",
              }],
              isError: true,
            };
          }
          throw error;
        }
      }

      case "fantastical_get_upcoming": {
        const { days = 7 } = args as { days?: number };

        const today = new Date();
        const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);

        const script = `
set output to ""
set rangeStart to current date
set hours of rangeStart to 0
set minutes of rangeStart to 0
set seconds of rangeStart to 0
set rangeEnd to rangeStart + (${days} * days)

tell application "Calendar"
  repeat with cal in calendars
    set calName to name of cal
    try
      set calEvents to (every event of cal whose start date >= rangeStart and start date < rangeEnd)
      repeat with evt in calEvents
        set evtTitle to summary of evt
        set evtStart to start date of evt
        set evtEnd to end date of evt
        set evtLoc to location of evt
        set output to output & calName & "|" & evtTitle & "|" & (evtStart as string) & "|" & (evtEnd as string) & "|" & evtLoc & "\\n"
      end repeat
    end try
  end repeat
end tell
return output`;

        try {
          const result = await runAppleScriptMultiline(script);
          const events = result
            .split("\n")
            .filter(line => line.trim())
            .map(line => {
              const [calendar, title, start, end, location] = line.split("|");
              return { calendar, title, start, end, location: location || "" };
            })
            .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                range: {
                  start: today.toISOString().split("T")[0],
                  end: endDate.toISOString().split("T")[0],
                  days,
                },
                count: events.length,
                events,
              }, null, 2),
            }],
          };
        } catch (error) {
          if (isCalendarPermissionError(error)) {
            // Offer to open Fantastical as a fallback (use URL scheme, not parse sentence)
            await openFantasticalUrl('x-fantastical3://show/calendar/today');
            return {
              content: [{
                type: "text",
                text: CALENDAR_PERMISSION_MESSAGE + "\n\nFallback: Opened Fantastical to today's view.",
              }],
              isError: true,
            };
          }
          throw error;
        }
      }

      case "fantastical_show_date": {
        const { date } = args as { date: string };

        // Use URL scheme to show date in Fantastical (not parse sentence which types into event dialog)
        await openFantasticalUrl(`x-fantastical3://show/calendar/${encodeURIComponent(date)}`);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Opened Fantastical to date: ${date}`,
            }, null, 2),
          }],
        };
      }

      case "fantastical_get_calendars": {
        const script = `
set output to ""
tell application "Calendar"
  repeat with cal in calendars
    set calName to name of cal
    set calColor to color of cal
    set output to output & calName & "\\n"
  end repeat
end tell
return output`;

        try {
          const result = await runAppleScriptMultiline(script);
          const calendars = result
            .split("\n")
            .filter(line => line.trim())
            .map(name => ({ name }));

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                count: calendars.length,
                calendars,
              }, null, 2),
            }],
          };
        } catch (error) {
          if (isCalendarPermissionError(error)) {
            return {
              content: [{
                type: "text",
                text: CALENDAR_PERMISSION_MESSAGE,
              }],
              isError: true,
            };
          }
          throw error;
        }
      }

      case "fantastical_search": {
        const { query } = args as { query: string };

        // Search using URL scheme which opens Fantastical's search (not parse sentence)
        await openFantasticalUrl(`x-fantastical3://search?query=${encodeURIComponent(query)}`);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Opened Fantastical search for: "${query}"`,
            }, null, 2),
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  // Check if on macOS
  if (process.platform !== "darwin") {
    console.error("Error: This MCP server only works on macOS (Fantastical is macOS-only)");
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Fantastical MCP server running");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
