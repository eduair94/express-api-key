# Changelog

All notable changes to this project will be documented in this file.

## [1.6.0] - 2026-09-30
### Changed
- `mongoose` is now a peer dependency (`^8.16.5 || ^9.0.0`), so the middleware always shares the
  host application's Mongoose instance and connection instead of installing its own copy.
- Supports Mongoose 9: the atomic key-renewal pipeline opts in with `updatePipeline: true`, and
  `findOneAndUpdate` calls use `returnDocument: "after"` instead of the deprecated `new` flag.
- Dependencies updated (discord.js 14.27, express 5.2, dotenv 18); built with TypeScript 7.

### Removed
- Unused `rate-limiter-flexible`, `uuid` and `uuid4` dependencies (keys use `crypto.randomUUID`).

## [1.5.1] - 2026-07-23
### Added
- Configurable API documentation link in the authenticated customer dashboard.

## [1.0.5] - 2025-07-27
### Added
- Improved documentation for CLI and key selling
- Added LICENSE, CONTRIBUTING.md, and CHANGELOG.md

### Changed
- Clarified exports and usage in README

### Fixed
- Minor validation and help output improvements
