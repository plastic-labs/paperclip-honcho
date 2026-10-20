import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { describe, expect, it, vi } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));

// #19: esbuild bundles worker.ts into the worker entry the manifest points at.
// A runWorker(plugin, import.meta.url) call left in worker.ts then passes its
// "am I the entrypoint" check and starts a second RPC host on the same stdin,
// so every host request runs, and is answered, twice.
describe("worker entry", () => {
  it("answers each host request exactly once", async () => {
    const outdir = join(root, "node_modules", ".cache", "paperclip-honcho-tests");
    mkdirSync(outdir, { recursive: true });
    const entry = join(outdir, "worker-bootstrap.js");
    // Bundled the way esbuild.config.mjs builds dist/worker-bootstrap.js.
    await build({
      entryPoints: [join(root, "src", "worker-bootstrap.ts")],
      outfile: entry,
      bundle: true,
      platform: "node",
      format: "esm",
      external: ["@paperclipai/plugin-sdk", "@paperclipai/shared", "react", "react-dom"],
      logLevel: "silent",
    });

    const worker = spawn(process.execPath, [entry], { stdio: ["pipe", "pipe", "ignore"] });
    let stdout = "";
    worker.stdout.setEncoding("utf8");
    worker.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    try {
      worker.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "health", params: {} })}\n`);
      await vi.waitFor(() => expect(stdout).toContain('"id":1'), { timeout: 10_000 });
      // Leave room for a second host's duplicate answer to arrive.
      await new Promise((resolve) => setTimeout(resolve, 300));
    } finally {
      worker.kill();
    }

    const answers = stdout
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as { id?: unknown })
      .filter((message) => message.id === 1);
    expect(answers).toHaveLength(1);
  }, 20_000);
});
