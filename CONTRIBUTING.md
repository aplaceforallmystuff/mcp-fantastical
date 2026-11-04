# Contributing

## Getting Started

Fork the repository and clone your fork with HTTPS. Use macOS with Node.js 18 or later and Fantastical installed. Install dependencies with `npm ci`, then create a branch for your change.

## Development

- `npm run watch` watches TypeScript sources.
- `npm run build` compiles TypeScript and builds the signed native EventKit helper on macOS.
- `npm test` exercises event URL generation without creating calendar events.

## Adding New Tools

Add the tool schema and handler in `src/index.ts`, update the README Available Tools table, and add regression coverage. Keep user text URL-encoded and preserve the AppleScript and EventKit permission handling.

## Code Style

Match the existing TypeScript formatting and naming. Keep credentials, personal calendar data and generated build output out of commits.

## Submitting Changes

Describe the user-visible behavior and the checks you ran. Run `npm run build`, `npm test`, and `npm audit --audit-level=high` before submitting a pull request. Changes that need a live calendar should explain the manual check separately.
