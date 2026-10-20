# Changelog

All notable changes to `@honcho-ai/paperclip-honcho` will be documented in this file.

## [0.1.4] - 2026-10-20

### Fixed
- Installs and activates on current Paperclip hosts, where plugin config is stored per company. Setup no longer fails with "company context is required" (#22, #18).
- **Initialize Honcho memory** completes on current hosts. It runs in the settings page action for the selected company instead of in the `initialize-memory` job (#20).
- Initialization works in calls of about 20 seconds, inside the host's 30-second action timeout. The worker keeps what each call read and imported, so the next call goes on where the last one stopped, and the settings page keeps calling while calls make progress. It retries a call the host timed out and stops when the page closes. Between calls the status shows initialization as partial, or as running after a call the host timed out until the next call starts.
- Each host request runs once. Fixes duplicate-key errors and "received response for unknown request id" during initialization (#19).
- Initialization maps every agent and issue to Honcho, not only the first 100 (#20).
- Two **Initialize Honcho memory** runs for one company, for example from two tabs, no longer overlap and import every message twice.
- Comments and documents imported by a call the host timed out are not appended again by the next issue sync. The item that call was importing is imported by the next call instead of being lost.
- Initialization reports items it could not import: the migration shows as partial with the first error, where it used to show complete. Running it again imports them. A comment that failed used to be skipped for good once a later comment on its issue was imported.
- A document that an issue event syncs while initialization is running is left to that sync. Initialization used to append the older revision it had read, and the next issue sync appended the newer one again.
- Initialization no longer stops with "Issue not found" on every call when an issue is deleted or made private while it runs.
- Issue events for a company whose config cannot reach Honcho, such as Honcho cloud with no API key, are skipped. They used to send Honcho unauthenticated requests and record the failures. Any URL on the Honcho cloud host, such as `http://api.honcho.dev`, now needs an API key too.
- The settings page loads, saves and validates the selected company's config on current hosts, and its connection check uses that company's config and workspace. It no longer saves when the company's config failed to load, and keeps edits typed while an autosave is in progress.
- `honcho_ask_peer` stays available to a company with peer chat on when another company turns it off (#18).
- Paperclip shows the plugin as 0.1.4. The 0.1.3 package reported 0.1.2.

### Changed
- Config is read for the company being acted on. With no company in scope the plugin fails instead of reading another company's plugin settings. A company with no API key of its own still falls back to the key in `~/.honcho/config.json` on the machine running Paperclip, which every such company shares. The settings page no longer suggests `HONCHO_API_KEY`, which Paperclip does not pass to plugin workers.
- A company with no saved settings syncs issue events only once it has connected to Honcho, for example through **Initialize Honcho memory**. Before, every company synced through a key in `~/.honcho/config.json` as soon as one existed.
- The settings page no longer triggers the `initialize-memory` job and does not re-save unchanged settings, so company members who are not instance admins can initialize with the stored settings. Changing settings still needs an instance admin. Running that job by hand only finishes a company queued by 0.1.3 or earlier.
- Initialization skips agents and issues that already have a Honcho peer or session. Normal syncs still refresh their metadata.
- Requires `@paperclipai/plugin-sdk` `^2026.1012.0`, which sends the company with each config read.

## [0.1.3] - 2026-07-09

### Added
- On-demand Honcho tools for agents: an optional per-company bridge registers this plugin's Honcho tools (memory search, ask-peer, issue/agent context) as native MCP tools an agent can call mid-run, instead of memory only flowing one way into Honcho. Configured via the new **Agent Runtime Home Path Template** setting; it is entirely plugin-side (the bridge script and its `config.toml` entry are written with plain filesystem access), so enabling it adds no new plugin capability and requires no upgrade re-approval.
- Reuse of the shared local Honcho config (`~/.honcho/config.json`, as used by Hermes/Claude Code/opencode) for the API key by default, so a self-hosted Paperclip on the same machine can connect with nothing pasted into plugin settings. Includes an optional, write-if-absent bootstrap of that file from the plugin's configured key.

### Changed
- Upgraded `@paperclipai/plugin-sdk` to `^2026.618.0` so the worker echoes the host-owned invocation scope on worker→host bridge calls (hosts began enforcing this in `2026.525.0`), restoring plugin activation on current Paperclip hosts. No plugin logic changed for this fix.
- The SDK is no longer bundled into `dist/` (it and `@paperclipai/shared` are resolved from `node_modules` at runtime), and `dist/` is no longer committed to git — build output is produced at publish/install time.
- Reworked Honcho auth precedence to: literal config key → `HONCHO_API_KEY`/`HONCHO_API_BASE_URL` env → shared `~/.honcho/config.json`. Removed the dead Paperclip secret-reference resolution path (that system is disabled platform-wide) and its `secrets.read-ref` capability; the settings page now takes a plain API-key field. Upgrade note: an install that stored its key as a Paperclip secret reference must re-enter the key.
- Stored workspace, peer, and session IDs are now treated as canonical for the life of a company/agent/issue and reused as-is. A company rename or `workspacePrefix` change never remaps an entity to a different Honcho workspace/peer/session. This reverts a prior "self-heal" that force-migrated a renamed company to a freshly-derived workspace, which orphaned all memory accumulated under the old one. Existing IDs and naming conventions are unchanged from 0.1.2.

### Fixed
- Fixed a duplication bug where an issue with multiple documents re-synced the trailing documents on every sync (and could silently drop edits to others). Document dedup now tracks the last-synced revision per document key instead of a single cross-document cursor.
- Fixed a duplication bug where the first event-driven sync after **Initialize Honcho memory** re-appended every comment the migration import had already written, by sharing dedup state between the migration and event-sync paths.
- Made migration import duplication-proof and resilient to the initialize-memory job's invocation scope expiring mid-import on large companies: candidates are deduped by source, the in-run provenance cache is updated before the (now best-effort) import-ledger write, and dedup falls back to Honcho's own session messages so a scope hiccup can neither abort the import nor produce duplicates on re-run.
- Agent peer IDs no longer drift when an agent is renamed — an existing agent's stored peer ID is reused instead of recomputed from the current name (previously this happened on every sync, silently orphaning the agent's Honcho peer).
- Upgrades are seamless for the new per-document sync cursor: issues synced before it existed back-fill from the legacy single cursor, so no documents re-emit on the first sync after upgrade.
- `initializeMemoryForCompany` now runs the mapping repair synchronously inside the properly-scoped action call rather than relying only on the unscoped job path, and runs it before the connection probe so a legacy mapping is self-healed before it can fail a check.
- Closed a time-of-check/time-of-use race in the `~/.honcho/config.json` bootstrap write (atomic `wx` create), preserving its "never overwrites an existing file" guarantee under concurrent callers.
- Stopped gating the cloud **Initialize Honcho memory** / **Test connection** buttons on the raw API-key form field, so a configuration whose key resolves from the environment or the shared local config is no longer blocked.
- Hardened `entities.ts` against live host quirks: `ctx.entities.list()` returning `null` instead of `[]`, and hosts that ignore `scopeKind`/`scopeId` filters (mapping counts are now filtered client-side per company). Also fixed a `size=200` messages/list call that exceeded Honcho's API cap of 100.

## [0.1.2] - 2026-04-13

### Changed
- Issue sessions now use the Paperclip issue identifier for new Honcho session names so the Honcho dashboard shows the same task label operators see in Paperclip.
- Existing workspace and issue session mappings are now treated as canonical, preventing later `workspacePrefix` edits from silently remapping Honcho workspaces or sessions.
- Settings changes now autosave by default with a debounce while keeping explicit save and activation flows available.
- Migration preview now includes a per-issue mapping breakdown so operators can see which issues will contribute comments and documents before import.
- Workspace and agent peer IDs are now readable while remaining collision-safe through stable short hashed suffixes.

### Fixed
- Fixed `agent_profile_files` imports so they create and map agent peers instead of incorrectly falling through the owner peer path.
- Restored canonical agent peer IDs so Honcho peers consistently use the Paperclip agent ID instead of drifting to URL-key-based names.
- Fixed session and workspace lookup paths to honor persisted mappings, keeping reads, writes, and repair actions aligned with previously created Honcho resources.
- Fixed initialization so the selected company is prepared before `initialize-memory` runs, preventing settings-page success state from hanging on the wrong company.
- Fixed transient null Honcho responses so initialization and sync retry instead of crashing late.
- Fixed migration dedupe by checking existing Honcho session provenance once per session and backfilling the import ledger when prior appends already exist.
- Fixed readable workspace helper generation so `buildWorkspaceId(...)` matches canonical named workspace IDs.
- Fixed stable ID hashing to use `sha256` instead of `sha1`.
- Fixed future peer/session contamination by blocking stale workspace mapping reuse when the saved workspace does not match the current canonical workspace.

## [0.1.1] - 2026-04-10

### Added
- Improved self-hosted and local Honcho support, including local-mode configuration paths that can run without a configured API key when the target Honcho instance does not require one.
- Clearer release documentation for local previewing, tunneled localhost workflows, and the current Paperclip host limitations around direct local connectivity.

### Changed
- Simplified the settings experience into a cleaner operator flow with a dedicated `Save settings` action and a single `Initialize Honcho memory` action for validation, connection testing, setup, and import.
- Reduced the amount of unsupported or manual-only controls shown in the UI so the settings page better matches what the public Paperclip host can actually do.
- Refined plugin configuration naming around the Honcho API key and agent observation settings for a cleaner public config surface.
- Updated activation progress handling so long-running initialization jobs poll more realistically and do not look failed during normal execution.

### Fixed
- Fixed initialization status reporting so completed initialization no longer falls back to a misleading running/preview state after zero-item migrations.
- Fixed the activation button state so it only appears active while initialization is actually running.
- Fixed self-hosted credential handling so configured API keys are still forwarded to secured non-cloud Honcho deployments.
- Fixed settings normalization for saved Honcho secret refs so whitespace does not break the selected secret in the UI.

## [0.1.0] - 2026-04-01

### Added
- Initial public-host-compatible release of the Honcho memory plugin for Paperclip.
- Tool-first memory surface for issue, workspace, session, agent, search, and peer-recall flows.
- Honcho workspace, peer, and issue-session mapping from Paperclip entities.
- Issue comment sync and issue document sync with bounded sectioning.
- Operator UI for configuration, connection testing, migration scan/import, initialization, repair, and prompt preview.

### Changed
- Plugin manifest reduced to the latest public Paperclip capability surface so local-path installation works on upstream `paperclipai@0.3.1`.
- Prompt memory is now operator-driven instead of relying on unreleased automatic prompt-injection hooks.

### Fixed
- Local path install packaging now bundles the manifest correctly for runtime loading.
- Ingested message content is hard-capped before upload to Honcho to avoid oversized writes.
