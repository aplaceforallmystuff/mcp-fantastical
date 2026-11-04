# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.2.1] - 2026-11-04

### Changed
- Require Node.js 20 or later to match the secure `@hono/node-server` 2.x dependency. Node.js 18 users must upgrade Node.js before installing this release.
- Refresh dependencies, combining Dependabot updates for body-parser, ip-address, fast-uri, hono and @hono/node-server; keep the audited adapter at 2.1.6.

### Fixed
- Percent-encode spaces in Fantastical event sentences, calendar names and notes, preserving literal plus signs (community PR #25 by @mattiacolombomc).
- Refresh compatible dependencies to clear the release security audit.

### Added
- Handler regression tests for URL encoding, reserved characters and optional immediate creation.

## [1.2.0] - 2026-04-20

### Fixed
- Calendar access denied under Claude Desktop due to TCC attribution failure ([#6](https://github.com/aplaceforallmystuff/mcp-fantastical/issues/6)). The EventKit helper is now wrapped in an ad-hoc-signed `FantasticalHelper.app` bundle with its own `CFBundleIdentifier` and `NSCalendarsFullAccessUsageDescription`, AND launched via `open -W` rather than direct `exec`. The bundle alone isn't enough — when spawned as a child of node, TCC treats the unsigned node binary (common with nvm/Homebrew Node installs) as the "responsible process" in the attribution chain and auto-denies without ever prompting. Routing through LaunchServices (`open`) detaches the helper from node's chain so it becomes its own responsible process. On first run, users see a one-time system prompt attributed to "FantasticalHelper".

### Changed
- Native helper path moved from `dist/native/fantastical-helper` to `dist/native/FantasticalHelper.app/Contents/MacOS/fantastical-helper`.
- Helper writes JSON to a temp file via a `--output <path>` argument (rather than stdout) because `open -W` detaches stdio from the caller. The TypeScript wrapper creates a per-invocation temp dir and reads the result back.
- Native helper timeout raised from 10s to 30s to accommodate the first-run TCC prompt.
- Native helper failures now log to stderr instead of being silently swallowed.

## [1.1.0] - 2026-02-27

### Added
- Native EventKit helper (`native/FantasticalHelper.swift`) for fast, reliable calendar access
- Fallback mechanism: tries EventKit helper first, falls back to AppleScript if unavailable
- Build script for native helper (`npm run build:native`)

### Fixed
- Calendar permission errors (-1743) when running in MCP subprocess contexts (#2)
- Timeouts on large calendars (3000+ events) due to slow AppleScript `whose` filters
- Stale repository references from old GitHub username (#1)

### Changed
- `fantastical_get_today`, `fantastical_get_upcoming`, `fantastical_get_calendars` now use EventKit by default
- Updated README with Full Calendar Access permission requirements and troubleshooting

Based on [PR #5](https://github.com/aplaceforallmystuff/mcp-fantastical/pull/5) by [@pdurlej](https://github.com/pdurlej) and [PR #1](https://github.com/aplaceforallmystuff/mcp-fantastical/pull/1) by [@jcbmrrs](https://github.com/jcbmrrs).

## [1.0.3] - 2025-11-29

### Fixed
- Corrected repository URLs in package.json

## [1.0.2] - 2025-11-29

### Fixed
- Date handling now uses `current date` reference in AppleScript for locale-independent filtering
- Event creation switched to URL scheme for improved reliability
- Added try/catch around calendar iteration for error resilience

## [1.0.1] - 2025-11-29

### Changed
- Added `mcpName` field to package.json for MCP registry compatibility

## [1.0.0] - 2025-11-29

### Added
- Initial release with MCP tools for Fantastical calendar management
- `fantastical_create_event` - Create events using natural language via Fantastical's parsing
- `fantastical_get_today` - View today's calendar events
- `fantastical_get_upcoming` - View upcoming events for specified number of days
- `fantastical_show_date` - Open Fantastical to a specific date
- `fantastical_get_calendars` - List all available calendars
- `fantastical_search` - Search for events by query
