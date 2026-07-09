import { describe, expect, it, vi } from "vitest";
import { resolveConfig } from "../src/config.js";
import { BRIDGE_SCRIPT_FILENAME, buildBridgeScriptSource, syncAgentRuntimeMcpBridge } from "../src/mcp-bridge.js";
import { createHonchoHarness } from "./helpers.js";

describe("honcho mcp bridge", () => {
  it("is skipped when no agent runtime home path template is configured", async () => {
    const harness = createHonchoHarness();
    const config = resolveConfig(await harness.ctx.config.get());

    const result = await syncAgentRuntimeMcpBridge(harness.ctx, "co_1", config);

    expect(result).toEqual({ status: "skipped" });
  });

  it("writes the bridge script and a config.toml entry, substituting {companyId}", async () => {
    const harness = createHonchoHarness({
      config: { agentRuntimeHomePathTemplate: "/homes/{companyId}/codex-home" },
    });
    const config = resolveConfig(await harness.ctx.config.get());

    const result = await syncAgentRuntimeMcpBridge(harness.ctx, "co_1", config);

    expect(result).toEqual({ status: "synced" });
    const status = await harness.ctx.localFolders.status("co_1", "agent-runtime-home");
    expect(status.path).toBe("/homes/co_1/codex-home");

    const script = await harness.ctx.localFolders.readText("co_1", "agent-runtime-home", BRIDGE_SCRIPT_FILENAME);
    expect(script).toBe(buildBridgeScriptSource());

    const toml = await harness.ctx.localFolders.readText("co_1", "agent-runtime-home", "config.toml");
    expect(toml).toContain("[mcp_servers.paperclip_honcho]");
    expect(toml).toContain(`args = ["/homes/co_1/codex-home/${BRIDGE_SCRIPT_FILENAME}"]`);
  });

  it("does not rewrite files on a repeat sync when nothing changed", async () => {
    const harness = createHonchoHarness({
      config: { agentRuntimeHomePathTemplate: "/homes/{companyId}/codex-home" },
    });
    const config = resolveConfig(await harness.ctx.config.get());
    await syncAgentRuntimeMcpBridge(harness.ctx, "co_1", config);

    const writeSpy = vi.spyOn(harness.ctx.localFolders, "writeTextAtomic");
    const result = await syncAgentRuntimeMcpBridge(harness.ctx, "co_1", config);

    expect(result).toEqual({ status: "synced" });
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("replaces a stale version block instead of duplicating it, preserving unrelated config.toml content", async () => {
    const harness = createHonchoHarness({
      config: { agentRuntimeHomePathTemplate: "/homes/{companyId}/codex-home" },
    });
    const config = resolveConfig(await harness.ctx.config.get());

    await harness.ctx.localFolders.configure({
      companyId: "co_1",
      folderKey: "agent-runtime-home",
      path: "/homes/co_1/codex-home",
      access: "readWrite",
    });
    await harness.ctx.localFolders.writeTextAtomic(
      "co_1",
      "agent-runtime-home",
      "config.toml",
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

    const result = await syncAgentRuntimeMcpBridge(harness.ctx, "co_1", config);
    expect(result).toEqual({ status: "synced" });

    const toml = await harness.ctx.localFolders.readText("co_1", "agent-runtime-home", "config.toml");
    expect(toml).toContain("model = \"gpt-5.5\"");
    expect(toml).toContain("[mcp_servers.other_tool]");
    expect(toml).not.toContain("/stale/path.cjs");
    expect(toml.match(/\[mcp_servers\.paperclip_honcho\]/g)).toHaveLength(1);
    expect(toml).toContain("/homes/co_1/codex-home/" + BRIDGE_SCRIPT_FILENAME);
  });

  it("generates a self-contained script exposing every manifest tool", async () => {
    const source = buildBridgeScriptSource();
    expect(() => new Function(source.replace(/^#!.*\n/, ""))).not.toThrow();
    expect(source).toContain("honcho_search_memory");
    expect(source).toContain("honcho_ask_peer");
    expect(source).toContain("/api/plugins/tools/execute");
  });
});
