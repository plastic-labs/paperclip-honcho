# @honcho-ai/paperclip-honcho

Add Honcho memory to Paperclip while keeping Paperclip as the system of record.

This package targets the current public/latest Paperclip host surface. It supports tools, sync, migration import, and manual prompt previews without depending on automatic prompt-context injection hooks, run transcript import, or legacy workspace file import.

## Install the Plugin

1. In Paperclip, open `Instance Settings` -> `Plugins`.
2. Click `Install Plugin`.
3. Enter `@honcho-ai/paperclip-honcho`.
4. Complete the install from the Paperclip UI.

## Quick Setup

### Minimal Path

1. Create a Paperclip secret containing the Honcho API key.
   - For normal cloud usage, this is required.
   - Local development does not require a Honcho API key, however, is currently discouraged because of the host repository not being able to reach `localhost` reliably. This can be fixed via a tunnel to the port Honcho runs on. 
2. Open the Honcho plugin settings page in Paperclip.
3. If you are using a self-hosted or local Honcho instance, switch the deployment to `Self-hosted / local` and set the base URL.
4. Select the API key secret.
5. Click `Save settings`.
6. Click `Initialize Honcho memory`.

## Multi-Agent Hierarchy

Paperclip memory is organized around company, issue, and agent boundaries:

- Company -> workspace: each Paperclip company maps to one Honcho workspace.
- Issue -> session: each Paperclip issue maps to one Honcho session inside that workspace.
- Humans and agents -> peers: human actors and Paperclip agents map to Honcho peers.

### Agent Observation

The current plugin exposes explicit observation settings:

- `observe_me` defaults to `true`
- `observe_others` defaults to `true`

That means agent peers can both be observed by Honcho and form representations of other peers they interact with.

### Hierarchy Context Availability

`honcho_get_hierarchy_context` is available, but delegated-work context depends on the Paperclip host providing lineage metadata. The tool degrades gracefully when that metadata is unavailable.

Prompt context is still conservative on the public-host-compatible path. The recommended starting configuration keeps `enablePromptContext: false`, and operators use manual prompt previews instead of relying on automatic injection hooks.

## How It Works

The integration breaks down into four parts:

- Identity and scope: Paperclip companies map to Honcho workspaces, issues map to sessions, and humans plus agents map to peers.
- Sync behavior: issue comments and document revisions sync into Honcho, with document content sectioned and normalized message content capped before ingestion.
- Operator controls: the plugin settings page provides setup, status, and initialization flows, plus an issue-level `Memory` tab.
- Agent tools: Paperclip agents get Honcho retrieval and peer-chat tools.

## Operator Actions

The current operator flow is intentionally narrow:

| Action | What it does |
| --- | --- |
| `Save settings` | Persists the current plugin configuration after validation. |
| `Initialize Honcho memory` | Validates config, tests the Honcho connection, creates core mappings, imports baseline issue memory, and verifies the initialization path. |
| `Resync this issue` | Replays sync for the current issue from the issue `Memory` tab. |

## Configuration Defaults

| Setting | Default | Use when |
| --- | --- | --- |
| `honchoApiKey` | — | Required for cloud-based setups. Leave it unset for local development. |
| `honchoApiBaseUrl` | `https://api.honcho.dev` | Override this for self-hosted or non-default Honcho deployments. |
| `workspacePrefix` | `paperclip` | Change this if you want a different workspace namespace. |
| `syncIssueComments` | `true` | Turn this off if you do not want comment history imported into Honcho. |
| `syncIssueDocuments` | `true` | Turn this off if you do not want issue document revisions imported. |
| `enablePeerChat` | `true` | Required for the peer chat tool surface. |
| `enablePromptContext` | `false` | Keep this off on the public-host-compatible path and use manual prompt previews instead. |
| `observe_me` | `true` | Controls whether agent peers are observed by Honcho. |
| `observe_others` | `true` | Controls whether agent peers form representations of other peers they interact with. |

The plugin also accepts additional advanced fields in the settings page, including noise-pattern and metadata-strip controls. Most setups can ignore those and start with the defaults above.

## Agent Tools

The plugin registers the following Honcho tools for Paperclip agents:

- `honcho_get_issue_context`
- `honcho_search_memory`
- `honcho_search_messages`
- `honcho_search_conclusions`
- `honcho_get_workspace_context`
- `honcho_get_session`
- `honcho_get_agent_context`
- `honcho_get_hierarchy_context`
- `honcho_ask_peer`

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

This repo keeps `dist/` checked in so local path installs and tarball validation work without extra publish-time build assumptions.
