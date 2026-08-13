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
 * - Accessibility permissions for osascript
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
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// The helper lives inside an ad-hoc-signed .app bundle and is launched via
// `open -W` so LaunchServices detaches it from node's attribution chain.
// Without this, TCC sees an unsigned node (from nvm/Homebrew) as the
// "responsible" process in the chain and auto-denies Calendar access without
// ever prompting the user. See issue #6 for full diagnosis.
const HELPER_APP_PATH = join(__dirname, "native", "FantasticalHelper.app");

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

async function runNativeHelper(
  command: string,
  arg?: string,
  flags?: Record<string, string | undefined>,
): Promise<string | null> {
  // Create a per-invocation temp directory for the JSON output, so concurrent
  // calls can't collide and we always clean up.
  const workDir = mkdtempSync(join(tmpdir(), "mcp-fantastical-"));
  const outputPath = join(workDir, "result.json");

  try {
    const helperArgs = [command];
    if (arg) helperArgs.push(arg);
    if (flags) {
      for (const [key, value] of Object.entries(flags)) {
        if (value !== undefined && value !== null && value !== "") {
          helperArgs.push(`--${key}`, String(value));
        }
      }
    }
    helperArgs.push("--output", outputPath);

    const quotedArgs = helperArgs.map(shellQuote).join(" ");
    // `open -W` waits for the launched app to exit. `-n` forces a new instance
    // (needed because each MCP call is independent). `-g` keeps it in the
    // background so no dock icon flashes even though LSUIElement is set.
    const cmd = `/usr/bin/open -W -n -g -a ${shellQuote(HELPER_APP_PATH)} --args ${quotedArgs}`;

    // 30s timeout leaves headroom for the one-time TCC prompt on first run.
    await execAsync(cmd, { timeout: 30000 });

    return readFileSync(outputPath, "utf8").trim();
  } catch (err) {
    console.error("[mcp-fantastical] native helper failed:", err instanceof Error ? err.message : err);
    return null;
  } finally {
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup failures
    }
  }
}

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
    description: "Get today's calendar events from Fantastical",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "fantastical_get_upcoming",
    description: "Get upcoming calendar events from Fantastical",
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
    description: "List all available calendars in Fantastical",
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
  {
    name: "fantastical_find_events",
    description: "Find events whose title matches a query and return their identifiers, so they can be updated or deleted. Searches a ±N day window via EventKit. Returns each event's stable 'id' for use with fantastical_update_event / fantastical_delete_event.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Case-insensitive substring to match against event titles",
        },
        days: {
          type: "number",
          description: "Search window in days, both past and future (default: 30)",
        },
        calendar: {
          type: "string",
          description: "Optional: restrict the search to a single calendar by name",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "fantastical_update_event",
    description: "Update an existing calendar event (reschedule, rename, move calendars, change location/notes). Requires the event 'id' from fantastical_find_events. Only the fields you provide are changed.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "The event identifier (from fantastical_find_events)",
        },
        title: { type: "string", description: "New title" },
        start: { type: "string", description: "New start time, ISO 8601 (e.g. 2026-06-02T15:00:00Z)" },
        end: { type: "string", description: "New end time, ISO 8601 (e.g. 2026-06-02T16:00:00Z)" },
        location: { type: "string", description: "New location" },
        notes: { type: "string", description: "New notes" },
        calendar: { type: "string", description: "Move the event to this calendar (by name)" },
      },
      required: ["id"],
    },
  },
  {
    name: "fantastical_delete_event",
    description: "Delete a calendar event. Requires the event 'id' from fantastical_find_events. For recurring events, span 'thisEvent' deletes only this occurrence (default); 'futureEvents' deletes this and all future occurrences.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "The event identifier (from fantastical_find_events)",
        },
        span: {
          type: "string",
          enum: ["thisEvent", "futureEvents"],
          description: "For recurring events: delete only this occurrence or this and all future (default: thisEvent)",
        },
      },
      required: ["id"],
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
        const script = `do shell script "open '${url}'"`;

        await runAppleScript(script);

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
        // Try native EventKit helper first (faster, no AppleScript permission issues)
        const nativeResult = await runNativeHelper("today");
        if (nativeResult) {
          return {
            content: [{
              type: "text",
              text: nativeResult,
            }],
          };
        }

        // Fallback to AppleScript
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
      }

      case "fantastical_get_upcoming": {
        const { days = 7 } = args as { days?: number };

        // Try native EventKit helper first (faster, no AppleScript permission issues)
        const nativeUpcoming = await runNativeHelper("upcoming", String(days));
        if (nativeUpcoming) {
          return {
            content: [{
              type: "text",
              text: nativeUpcoming,
            }],
          };
        }

        // Fallback to AppleScript
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
      }

      case "fantastical_show_date": {
        const { date } = args as { date: string };

        // Use URL scheme to show date in Fantastical
        const script = `do shell script "open 'x-fantastical3://show/calendar/${encodeURIComponent(date)}'"`;
        await runAppleScript(script);

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
        // Try native EventKit helper first (faster, no AppleScript permission issues)
        const nativeCalendars = await runNativeHelper("calendars");
        if (nativeCalendars) {
          return {
            content: [{
              type: "text",
              text: nativeCalendars,
            }],
          };
        }

        // Fallback to AppleScript
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
      }

      case "fantastical_search": {
        const { query } = args as { query: string };

        // Search using URL scheme which opens Fantastical's search
        const script = `do shell script "open 'x-fantastical3://search?query=${encodeURIComponent(query)}'"`;
        await runAppleScript(script);

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

      case "fantastical_find_events": {
        const { query, days, calendar } = args as {
          query: string;
          days?: number;
          calendar?: string;
        };

        const result = await runNativeHelper("find", undefined, {
          query,
          days: days !== undefined ? String(days) : undefined,
          calendar,
        });

        if (!result) {
          throw new Error(
            "Native EventKit helper failed. Finding events requires the FantasticalHelper " +
            "with Calendar access (System Settings > Privacy & Security > Calendars).",
          );
        }

        return { content: [{ type: "text", text: result }] };
      }

      case "fantastical_update_event": {
        const { id, title, start, end, location, notes, calendar } = args as {
          id: string;
          title?: string;
          start?: string;
          end?: string;
          location?: string;
          notes?: string;
          calendar?: string;
        };

        const result = await runNativeHelper("update", undefined, {
          id, title, start, end, location, notes, calendar,
        });

        if (!result) {
          throw new Error(
            "Native EventKit helper failed. Updating events requires the FantasticalHelper " +
            "with Calendar access (System Settings > Privacy & Security > Calendars).",
          );
        }

        // Surface helper-level errors (bad id, invalid date, etc.) as tool errors.
        const parsed = JSON.parse(result);
        if (parsed.error) {
          return {
            content: [{ type: "text", text: `Error: ${parsed.error}` }],
            isError: true,
          };
        }

        return { content: [{ type: "text", text: result }] };
      }

      case "fantastical_delete_event": {
        const { id, span } = args as { id: string; span?: string };

        const result = await runNativeHelper("delete", undefined, { id, span });

        if (!result) {
          throw new Error(
            "Native EventKit helper failed. Deleting events requires the FantasticalHelper " +
            "with Calendar access (System Settings > Privacy & Security > Calendars).",
          );
        }

        const parsed = JSON.parse(result);
        if (parsed.error) {
          return {
            content: [{ type: "text", text: `Error: ${parsed.error}` }],
            isError: true,
          };
        }

        return { content: [{ type: "text", text: result }] };
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
