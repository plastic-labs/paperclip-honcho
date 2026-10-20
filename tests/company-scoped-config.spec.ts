import { afterEach, describe, expect, it, vi } from "vitest";
import plugin from "../src/worker.js";
import { getResolvedConfig } from "../src/config.js";
import { createHonchoHarness, installFetchMock } from "./helpers.js";

afterEach(() => {
  vi.restoreAllMocks();
});

// Paperclip >= 2026.9 scopes plugin config per company. Outside a host
// invocation that carries a company (plugin setup, scheduled jobs),
// `ctx.config.get()` without an argument throws, and before this fix that
// failed activation outright:
//   Worker initialize failed: ... is not allowed to perform "config.get":
//   company context is required
function makeHostRequireCompany(harness: ReturnType<typeof createHonchoHarness>) {
  const original = harness.ctx.config.get.bind(harness.ctx.config);
  const calls: Array<string | undefined> = [];
  harness.ctx.config.get = async (companyId?: string) => {
    calls.push(companyId);
    if (!companyId) {
      throw new Error('Plugin "honcho" is not allowed to perform "config.get": company context is required');
    }
    return await original(companyId);
  };
  return calls;
}

describe("company-scoped plugin config (Paperclip >= 2026.9)", () => {
  it("activates when config.get() needs a company during setup", async () => {
    installFetchMock();
    const harness = createHonchoHarness();
    makeHostRequireCompany(harness);

    await expect(plugin.definition.setup(harness.ctx)).resolves.not.toThrow();

    // The host scopes the action to the settings page's company.
    const result = await harness.performAction<Record<string, unknown>>("test-connection", {}, { companyId: "co_1" });
    expect(result.ok).toBe(true);
  });

  it("passes the known company and never borrows another company's config", async () => {
    installFetchMock();
    const harness = createHonchoHarness();
    const calls = makeHostRequireCompany(harness);

    const scoped = await getResolvedConfig(harness.ctx, "co_1");
    expect(scoped.honchoApiBaseUrl).toBeTruthy();
    expect(calls).toEqual(["co_1"]);

    await expect(getResolvedConfig(harness.ctx)).rejects.toThrow("company context is required");
    expect(calls.slice(1)).toEqual([undefined]);
  });

  it("keeps honcho_ask_peer for a company that enables chat when the first company disables it", async () => {
    installFetchMock();
    const harness = createHonchoHarness({ config: { enablePeerChat: false } });
    // co_1 (the company setup() sees first) disables peer chat; co_2 enables it.
    const original = harness.ctx.config.get.bind(harness.ctx.config);
    harness.ctx.config.get = async (companyId?: string) => {
      const config = await original(companyId);
      return companyId === "co_2" ? { ...config, enablePeerChat: true } : config;
    };

    await plugin.definition.setup(harness.ctx);

    const disabled = await harness.executeTool("honcho_ask_peer", { targetPeerId: "peer", query: "Status?" }, {
      companyId: "co_1", projectId: "proj_1", agentId: "agent_1", runId: "run_1",
    });
    expect(disabled.error).toBe("Honcho peer chat is disabled in plugin config");

    const enabled = await harness.executeTool("honcho_ask_peer", { targetPeerId: "peer", query: "Status?" }, {
      companyId: "co_2", projectId: "proj_1", agentId: "agent_1", runId: "run_1",
    });
    expect(enabled.error).not.toBe("Honcho peer chat is disabled in plugin config");
  });
});
