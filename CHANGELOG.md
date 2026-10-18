# Changelog

All notable changes to this project will be documented in this file.

## [1.7.3] - 2026-10-18
### Changed
- Dependency ranges for the CLI-only packages relaxed so host apps dedupe them: `discord.js`
  `^14.21.0` (the Discord bot), `dotenv` `^16.0.0 || ^17.0.0 || ^18.0.0` (`dotenv/config` in the CLI).
  The middleware and dashboard import neither. No code changes.

## [1.7.2] - 2026-10-18
### Added
- The auto-renew panel's "Requests per cycle" form takes its `min` / `step` from the
  subscription service's status (`requestBounds: { min, step }`), so each service offers its
  own amounts (Spotify sells from 20,000 in steps of 10,000). An older service that does not
  send them keeps the previous 50,000 / 50,000.

## [1.7.1] - 2026-10-17
### Security
- The dashboard login only looks up a plain-string API key (≤ 200 characters). The form and
  JSON body parsers turned `apiKey[$regex]=…` into an operator object that matched stored keys;
  the 500-when-a-key-matches / 401-when-none difference let anyone read keys out one character
  at a time. Non-strings are now refused with 400 before any database call.

### Added
- A key the application revoked (`active: false`, a field this package does not declare) gets a
  "This API key was revoked" banner and no "Add credits" / renewal / auto-renew links.

## [1.7.0] - 2026-10-17
### Added
- `renewUrl` option: the dashboard shows an "Add credits" button, "Renew now" / "Add credits"
  links in the expiring-key and high-usage insights, and a banner for an expired key or a spent
  per-key balance, all opening `<renewUrl>?mode=renew&src=dashboard#key=<key>`. The key rides in
  the URL fragment, which is never sent to a server.
- Auto-renew panel states: a key without a subscription is offered "Turn on auto-renew"
  (`&autorenew=1`) or told why it cannot have one; a cancelled one can be turned back on; a
  suspended one is shown as paused.
- `buildRenewUrl()` and `parseSubscriptionStatus()` exports.

### Changed
- The subscription panel is restyled with the dashboard's own light/dark card styles, and reads
  "Auto-renew" with On / Paused / Off. Dates are shown in UTC.
- The dashboard page is served with `Cache-Control: no-store` (it contains the key).
- `dotenv` range relaxed to `^18.0.0` so host apps on any dotenv 18 dedupe it.

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
