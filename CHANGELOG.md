# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
