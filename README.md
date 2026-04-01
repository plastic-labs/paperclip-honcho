# @honcho-ai/paperclip-honcho

Tool-first Honcho memory integration for Paperclip.

This package is designed to install on the public/latest Paperclip host surface without requiring unreleased host capabilities.

## Feature Set

- maps each Paperclip company to a Honcho workspace
- maps agents and human actors to Honcho peers
- maps Paperclip issues to Honcho sessions
- syncs Paperclip issue comments into Honcho
- syncs Paperclip issue document revisions into Honcho in bounded sections
- enforces a hard ingest cap on normalized message content before sending it to Honcho
- exposes Honcho retrieval tools to agents
- adds an issue Memory tab for operators
- adds a custom plugin settings page for setup, validation, connection testing, migration scan/import, and repair actions
- supports manual prompt-context preview/probe for operators

Paperclip remains the system of record. Honcho is a derived memory layer.

## What This Compact Package Does Not Use

This public-host-compatible package does not depend on:

- automatic prompt-context injection hooks
- run transcript import
- legacy workspace file import
- delegation/run-lineage reconstruction

Those deeper features can be added later when the host surface expands.

## Current Capabilities

The plugin requests:

- `companies.read`
- `projects.read`
- `project.workspaces.read`
- `issues.read`
- `issue.comments.read`
- `issue.documents.read`
- `agents.read`
- `plugin.state.read`
- `plugin.state.write`
- `events.subscribe`
- `jobs.schedule`
- `agent.tools.register`
- `http.outbound`
- `secrets.read-ref`
- `instance.settings.register`
- `ui.detailTab.register`
- `ui.action.register`

## Agent-Facing Tools

- `honcho_get_issue_context`
- `honcho_search_memory`
- `honcho_search_messages`
- `honcho_search_conclusions`
- `honcho_get_workspace_context`
- `honcho_get_session`
- `honcho_get_agent_context`
- `honcho_get_hierarchy_context`
- `honcho_ask_peer`

`honcho_get_hierarchy_context` degrades gracefully on hosts that do not expose lineage data.

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

## Build Output

The published package includes:

- `dist/manifest.js`
- `dist/worker.js`
- `dist/ui/index.js`

## Install Into Paperclip

From a local checkout of this repo:

```bash
pnpm build
pnpm paperclipai plugin install /absolute/path/to/paperclip-honcho
```

From a packed tarball:

```bash
pnpm paperclipai plugin install /absolute/path/to/honcho-ai-paperclip-honcho-0.1.0.tgz
```

## Operator Setup

1. Create a Paperclip secret containing the Honcho API key.
2. Open the Honcho plugin settings page in Paperclip.
3. Set:
   - `honchoApiKeySecretRef`
   - `workspacePrefix` if you want something other than `paperclip`
   - `syncIssueComments`
   - `syncIssueDocuments`
   - `enablePeerChat`
4. Save settings.
5. Run:
   - `Validate config`
   - `Test connection`
   - `Initialize memory for this company`
6. Optionally run:
   - `Rescan migration sources`
   - `Import history`
   - `Repair mappings`
   - `Preview prompt context`

Recommended starting configuration:

- `syncIssueComments: true`
- `syncIssueDocuments: true`
- `enablePromptContext: false`
- `enablePeerChat: true`
- `observeAgentPeers: false`

## Notes

- Document content is sectioned before import.
- Normalized message content is capped before ingestion to avoid oversized writes into Honcho.
- This repo keeps `dist/` checked in so local path installs and tarball validation work without extra publish-time build assumptions.
