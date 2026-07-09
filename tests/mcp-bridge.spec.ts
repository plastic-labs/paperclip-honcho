import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveConfig } from "../src/config.js";
import { BRIDGE_SCRIPT_FILENAME, buildBridgeScriptSource, syncAgentRuntimeMcpBridge } from "../src/mcp-bridge.js";

let baseDir: string;

function configForTemplate(template: string) {
  return resolveConfig({ agentRuntimeHomePathTemplate: template });
}

describe("honcho mcp bridge", () => {
  beforeEach(() => {
    baseDir = fs.mkdtempSync(join(tmpdir(), "honcho-codex-home-"));
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("is skipped when no agent runtime home path template is configured", async () => {
    const result = await syncAgentRuntimeMcpBridge("co_1", configForTemplate(""));
    expect(result).toEqual({ status: "skipped" });
  });

  it("fails softly when the configured runtime home does not exist yet", async () => {
    const result = await syncAgentRuntimeMcpBridge(
      "co_1",
      configForTemplate(join(baseDir, "{companyId}", "codex-home")),
    );
    expect(result.status).toBe("failed");
  });

  it("writes the bridge script and a config.toml entry, substituting {companyId}", async () => {
    const home = join(baseDir, "co_1");
    fs.mkdirSync(home, { recursive: true });

    const result = await syncAgentRuntimeMcpBridge("co_1", configForTemplate(join(baseDir, "{companyId}")));

    expect(result).toEqual({ status: "synced" });
    expect(fs.readFileSync(join(home, BRIDGE_SCRIPT_FILENAME), "utf8")).toBe(buildBridgeScriptSource());
    const toml = fs.readFileSync(join(home, "config.toml"), "utf8");
    expect(toml).toContain("[mcp_servers.paperclip_honcho]");
    expect(toml).toContain(`args = [${JSON.stringify(join(home, BRIDGE_SCRIPT_FILENAME))}]`);
    expect(toml).toContain("env_vars = [\"PAPERCLIP_API_URL\"");
  });

  it("does not rewrite files on a repeat sync when nothing changed", async () => {
    const home = join(baseDir, "co_1");
    fs.mkdirSync(home, { recursive: true });
    const template = join(baseDir, "{companyId}");
    await syncAgentRuntimeMcpBridge("co_1", configForTemplate(template));

    const scriptIno = fs.statSync(join(home, BRIDGE_SCRIPT_FILENAME)).ino;
    const tomlIno = fs.statSync(join(home, "config.toml")).ino;

    const result = await syncAgentRuntimeMcpBridge("co_1", configForTemplate(template));

    // Unchanged content → files left untouched. writeTextAtomic swaps in a new
    // inode via rename, so a stable inode proves no rewrite occurred.
    expect(result).toEqual({ status: "synced" });
    expect(fs.statSync(join(home, BRIDGE_SCRIPT_FILENAME)).ino).toBe(scriptIno);
    expect(fs.statSync(join(home, "config.toml")).ino).toBe(tomlIno);
  });

  it("replaces a stale version block instead of duplicating it, preserving unrelated config.toml content", async () => {
    const home = join(baseDir, "co_1");
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(
      join(home, "config.toml"),
      [
        "model = \"gpt-5.5\"",
        "",
        "# paperclip-honcho-mcp-bridge version: 0",
        "[mcp_servers.paperclip_honcho]",
        "command = \"node\"",
        "args = [\"/stale/path.cjs\"]",
        "",
        "[mcp_servers.other_tool]",
        "command = \"echo\"",
        "args = []",
      ].join("\n"),
    );

    const result = await syncAgentRuntimeMcpBridge("co_1", configForTemplate(join(baseDir, "{companyId}")));
    expect(result).toEqual({ status: "synced" });

    const toml = fs.readFileSync(join(home, "config.toml"), "utf8");
    expect(toml).toContain("model = \"gpt-5.5\"");
    expect(toml).toContain("[mcp_servers.other_tool]");
    expect(toml).not.toContain("/stale/path.cjs");
    expect(toml.match(/\[mcp_servers\.paperclip_honcho\]/g)).toHaveLength(1);
    expect(toml).toContain(join(home, BRIDGE_SCRIPT_FILENAME));
  });

  it("generates a self-contained script exposing every manifest tool", () => {
    const source = buildBridgeScriptSource();
    expect(() => new Function(source.replace(/^#!.*\n/, ""))).not.toThrow();
    expect(source).toContain("honcho_search_memory");
    expect(source).toContain("honcho_ask_peer");
    expect(source).toContain("/api/plugins/tools/execute");
  });
});
