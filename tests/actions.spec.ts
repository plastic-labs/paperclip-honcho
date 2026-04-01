import { afterEach, describe, expect, it, vi } from "vitest";
import plugin from "../src/worker.js";
import { createHonchoHarness, installFetchMock } from "./helpers.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("honcho memory actions and status data", () => {
  it("returns memory-status data with the richer company memory state model", async () => {
    installFetchMock();
    const harness = createHonchoHarness();

    await plugin.definition.setup(harness.ctx);

    const status = await harness.getData<Record<string, unknown>>("memory-status", {
      companyId: "co_1",
    });

    expect(status.config).toMatchObject({
      honchoApiBaseUrl: "https://api.honcho.dev",
      honchoApiKeySecretRef: "HONCHO_API_KEY",
      workspacePrefix: "paperclip",
      syncIssueComments: true,
      syncIssueDocuments: true,
      enablePromptContext: false,
    });
    expect(status.validation).toMatchObject({
      ok: true,
      warnings: [],
      errors: [],
    });
    expect(status.companyStatus).toMatchObject({
      connectionStatus: "not_configured",
      workspaceStatus: "unknown",
      peerStatus: "not_started",
      initializationStatus: "not_started",
      migrationStatus: "not_started",
      promptContextStatus: "inactive",
      pendingFailureCount: 0,
      latestMigrationPreview: null,
      lastInitializationReport: null,
    });
    expect(status.counts).toMatchObject({
      mappedPeers: 0,
      mappedSessions: 0,
      importedComments: 0,
      importedDocuments: 0,
      importedRuns: 0,
    });
  });

  it("probe-prompt-context marks prompt context active on success", async () => {
    installFetchMock();
    const harness = createHonchoHarness({
      config: {
        enablePromptContext: true,
      },
    });

    await plugin.definition.setup(harness.ctx);

    const result = await harness.performAction<Record<string, unknown>>("probe-prompt-context", {
      companyId: "co_1",
      issueId: "iss_1",
      agentId: "agent_1",
      prompt: "auth regression",
    });

    expect(result.status).toBe("active");
    expect(result.preview).toEqual(expect.stringContaining("Task session memory"));

    const status = await harness.getData<Record<string, unknown>>("memory-status", {
      companyId: "co_1",
    });
    expect(status.companyStatus).toMatchObject({
      promptContextStatus: "active",
    });
  });

  it("probe-prompt-context marks prompt context degraded on failure", async () => {
    installFetchMock({ failOn: ["/context"] });
    const harness = createHonchoHarness({
      config: {
        enablePromptContext: true,
      },
    });

    await plugin.definition.setup(harness.ctx);

    await expect(
      harness.performAction("probe-prompt-context", {
        companyId: "co_1",
        issueId: "iss_1",
        agentId: "agent_1",
      }),
    ).rejects.toThrow();

    const status = await harness.getData<Record<string, unknown>>("memory-status", {
      companyId: "co_1",
    });
    expect(status.companyStatus).toMatchObject({
      promptContextStatus: "degraded",
      lastError: expect.objectContaining({
        message: expect.stringContaining("failed"),
      }),
    });
    expect(Number((status.companyStatus as Record<string, unknown>).pendingFailureCount)).toBeGreaterThanOrEqual(1);
  });
});
