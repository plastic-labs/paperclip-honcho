# Contributing to the Honcho Paperclip Plugin

## Development Setup

### Prerequisites

- Node.js 20+
- `pnpm`
- A Honcho API key from [honcho.dev](https://honcho.dev)
- A Paperclip checkout for end-to-end testing

### Clone and Install

```bash
git clone https://github.com/plastic-labs/paperclip-honcho.git
cd paperclip-honcho
pnpm install
```

### Build

```bash
pnpm build
```

This produces:

- `dist/manifest.js`
- `dist/worker.js`
- `dist/ui/index.js`

### Test

```bash
pnpm test
```

### Typecheck

```bash
pnpm typecheck
```

## Project Structure

```text
paperclip-honcho/
├── src/                # Plugin source: manifest, worker, UI, sync, config
├── tests/              # Vitest coverage for config, actions, sync, tools, jobs
├── dist/               # Built plugin artifacts
├── esbuild.config.mjs  # Bundle entrypoints
├── vitest.config.ts    # Test runner config
└── package.json        # Package metadata and Paperclip plugin wiring
```

## Local Development With Paperclip

1. Build the plugin:

   ```bash
   pnpm build
   ```

2. Start a Paperclip instance in a separate checkout.

3. Install the plugin by local path:

   ```bash
   PAPERCLIP_API_URL=http://127.0.0.1:3101 pnpm paperclipai plugin install /absolute/path/to/paperclip-honcho
   ```

4. Open Paperclip settings and configure the Honcho API key secret.

## Notes

- This repo mirrors the plugin package shape used inside the Paperclip monorepo.
- The published Paperclip plugin SDK currently lags some newer monorepo-only surfaces. If you extend the plugin, verify the standalone repo against the published SDK before publishing.
- Keep changes additive and preserve compatibility with the latest public Paperclip host surface unless you are explicitly coordinating a Paperclip host release.
