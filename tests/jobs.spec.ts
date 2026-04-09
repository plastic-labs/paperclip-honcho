import { afterEach, describe, expect, it, vi } from "vitest";
import plugin from "../src/worker.js";
import { createHonchoHarness, installFetchMock, requestsMatching } from "./helpers.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("honcho memory jobs", () => {
  it("initialize-memory creates company memory state, mappings, and an initialization report", async () => {
    installFetchMock();
    const harness = createHonchoHarness();

    await plugin.definition.setup(harness.ctx);
    await harness.runJob("initialize-memory");

    const status = await harness.getData<Record<string, unknown>>("memory-status", {
      companyId: "co_1",
    });
    expect(status.companyStatus).toMatchObject({
      connectionStatus: "connected",
      workspaceStatus: expect.stringMatching(/mapped|created/),
      peerStatus: expect.stringMatching(/partial|complete/),
      initializationStatus: "complete",
      migrationStatus: expect.stringMatching(/partial|complete/),
      promptContextStatus: "inactive",
      lastInitializationReport: expect.objectContaining({
        companyId: "co_1",
      }),
    });
    expect(status.counts).toMatchObject({
      mappedPeers: expect.any(Number),
      mappedSessions: expect.any(Number),
      importedComments: 2,
      importedDocuments: 1,
      importedRuns: 0,
    });

    const workspaceMappings = await harness.ctx.entities.list({
      entityType: "honcho-workspace-mapping",
      scopeKind: "company",
      scopeId: "co_1",
    });
    const importLedger = await harness.ctx.entities.list({
      entityType: "honcho-import-ledger",
      scopeKind: "company",
      scopeId: "co_1",
    });
    expect(workspaceMappings).toHaveLength(1);
    expect(importLedger.map((record) => record.externalId)).toEqual(expect.arrayContaining([
      "paperclip:comment:c_1",
      "paperclip:comment:c_2",
      "paperclip:document:rev_2:design:r2:s0",
    ]));
  });

  it("initialize-memory records auth_failed without falsely activating memory when configuration is invalid", async () => {
    installFetchMock();
    const harness = createHonchoHarness({
      config: {
        honchoApiKey: "",
      },
    });

    await plugin.definition.setup(harness.ctx);

    await expect(harness.runJob("initialize-memory")).rejects.toThrow("Honcho API key is required");

    const status = await harness.getData<Record<string, unknown>>("memory-status", {
      companyId: "co_1",
    });
    expect(status.companyStatus).toMatchObject({
      connectionStatus: "auth_failed",
      initializationStatus: "failed",
        promptContextStatus: "inactive",
        pendingFailureCount: 1,
        lastError: expect.objectContaining({
        message: expect.stringContaining("Honcho API key is required"),
      }),
    });
  });

  it("initialize-memory works against self-hosted Honcho without an API key secret", async () => {
    const { requests } = installFetchMock();
    const harness = createHonchoHarness({
      config: {
        honchoApiBaseUrl: "http://127.0.0.1:8000",
        honchoApiKey: "",
      },
    });

    await plugin.definition.setup(harness.ctx);
    await harness.runJob("initialize-memory");

    const status = await harness.getData<Record<string, unknown>>("memory-status", {
      companyId: "co_1",
    });
    expect(status.companyStatus).toMatchObject({
      connectionStatus: "connected",
      initializationStatus: "complete",
    });

    const workspaceRequest = requestsMatching(requests, "/v3/workspaces")[0];
    expect(workspaceRequest?.headers.authorization).toBeUndefined();
  });

  it("initialize-memory marks migration complete even when there is nothing to import", async () => {
    installFetchMock();
    const harness = createHonchoHarness({
      seed: {
        issueComments: [],
        issueDocuments: [],
        documentRevisions: [],
      },
    });

    await plugin.definition.setup(harness.ctx);
    await harness.runJob("initialize-memory");

    const status = await harness.getData<Record<string, unknown>>("memory-status", {
      companyId: "co_1",
    });
    expect(status.companyStatus).toMatchObject({
      initializationStatus: "complete",
      migrationStatus: "complete",
      latestMigrationPreview: expect.objectContaining({
        estimatedMessages: 0,
      }),
    });
  });

  it("migration-scan produces stable preview counts for comments and documents", async () => {
    installFetchMock();
    const harness = createHonchoHarness();

    await plugin.definition.setup(harness.ctx);
    await harness.runJob("migration-scan");

    const preview = await harness.getData<Record<string, unknown>>("migration-preview", {
      companyId: "co_1",
    });
    expect(preview).toMatchObject({
      sourceTypes: expect.arrayContaining(["issue_comments", "issue_documents"]),
      totals: {
        comments: 2,
        documents: 1,
        files: 0,
      },
      warnings: expect.arrayContaining([
        expect.stringContaining("Legacy workspace file import is unavailable"),
      ]),
    });

    const status = await harness.getData<Record<string, unknown>>("memory-status", {
      companyId: "co_1",
    });
    expect(status.companyStatus).toMatchObject({
      migrationStatus: "preview_ready",
      latestMigrationPreview: expect.objectContaining({
        totals: expect.objectContaining({
          comments: 2,
          documents: 1,
          files: 0,
        }),
      }),
    });
  });

  it("migration-import imports issue comments and issue documents into issue sessions", async () => {
    const { requests } = installFetchMock();
    const harness = createHonchoHarness();

    await plugin.definition.setup(harness.ctx);
    await harness.runJob("migration-scan");
    await harness.runJob("migration-import");

    const importLedger = await harness.ctx.entities.list({
      entityType: "honcho-import-ledger",
      scopeKind: "company",
      scopeId: "co_1",
    });
    expect(importLedger.map((record) => record.externalId)).toEqual(expect.arrayContaining([
      "paperclip:comment:c_1",
      "paperclip:comment:c_2",
      "paperclip:document:rev_2:design:r2:s0",
    ]));

    const messageRequests = requestsMatching(requests, "/messages");
    const messages = messageRequests.flatMap((request) => (request.body?.messages ?? []) as Array<Record<string, unknown>>);
    expect(messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        peer_id: "user_user_1",
        metadata: expect.objectContaining({
          contentType: "issue_comment",
          commentId: "c_1",
        }),
      }),
      expect.objectContaining({
        peer_id: "agent_agent_1",
        metadata: expect.objectContaining({
          contentType: "issue_document_section",
          documentRevisionId: "rev_2",
        }),
      }),
    ]));
  });

  it("uses Honcho-safe ids and payload field names during initialization", async () => {
    const { requests } = installFetchMock();
    const harness = createHonchoHarness();

    await plugin.definition.setup(harness.ctx);
    await harness.runJob("initialize-memory");

    const workspaceRequest = requestsMatching(requests, "/v3/workspaces")[0];
    expect(workspaceRequest?.body).toMatchObject({
      id: "paperclip_co_1",
    });

    const peerRequest = requestsMatching(requests, "/peers")[0];
    expect(peerRequest?.body).toMatchObject({
      id: "agent_agent_1",
      configuration: expect.any(Object),
    });
    expect(peerRequest?.body).not.toHaveProperty("config");

    const sessionRequest = requestsMatching(requests, "/sessions").find((request) => request.body?.id === "issue_iss_1");
    expect(sessionRequest?.body).toMatchObject({
      id: "issue_iss_1",
    });

    const messageRequest = requestsMatching(requests, "/messages")[0];
    const firstMessage = ((messageRequest?.body?.messages ?? []) as Array<Record<string, unknown>>)[0];
    expect(firstMessage).toMatchObject({
      peer_id: expect.stringMatching(/^(agent|user|owner|system)_/),
    });
    expect(firstMessage).not.toHaveProperty("id");
  });

  it("retries bounded Honcho rate limits during initialization", async () => {
    const { requests } = installFetchMock({
      rateLimitOnceOn: ["/v3/workspaces"],
    });
    const harness = createHonchoHarness();

    await plugin.definition.setup(harness.ctx);
    await harness.runJob("initialize-memory");

    const workspaceRequests = requestsMatching(requests, "/v3/workspaces");
    expect(workspaceRequests.length).toBeGreaterThanOrEqual(2);

    const status = await harness.getData<Record<string, unknown>>("memory-status", {
      companyId: "co_1",
    });
    expect(status.companyStatus).toMatchObject({
      connectionStatus: "connected",
      initializationStatus: "complete",
    });
  });

  it("migration-import is idempotent across reruns and filters low-signal transcript noise", async () => {
    const { requests } = installFetchMock();
    const harness = createHonchoHarness();

    await plugin.definition.setup(harness.ctx);
    await harness.runJob("migration-scan");
    await harness.runJob("migration-import");
    const messageRequestsAfterFirstImport = requestsMatching(requests, "/messages").length;
    await harness.runJob("migration-import");

    const status = await harness.getData<Record<string, unknown>>("memory-status", {
      companyId: "co_1",
    });
    expect(status.companyStatus).toMatchObject({
      migrationStatus: "complete",
    });
    expect(status.counts).toMatchObject({
      importedComments: 2,
      importedDocuments: 1,
      importedRuns: 0,
      importedFiles: 0,
    });

    const messageRequests = requestsMatching(requests, "/messages");
    expect(messageRequests.length).toBe(messageRequestsAfterFirstImport);
    const messages = messageRequests.flatMap((request) => (request.body?.messages ?? []) as Array<Record<string, unknown>>);
    expect(messages.some((message) => String(message.content).includes("Stable chunk"))).toBe(true);

    const importLedger = await harness.ctx.entities.list({
      entityType: "honcho-import-ledger",
      scopeKind: "company",
      scopeId: "co_1",
    });
    expect(importLedger).toHaveLength(3);
  });

  it("repair-mappings recreates missing workspace/session mappings without reimporting memory", async () => {
    installFetchMock();
    const harness = createHonchoHarness();

    await plugin.definition.setup(harness.ctx);
    await harness.runJob("initialize-memory");

    await harness.ctx.entities.upsert({
      entityType: "honcho-workspace-mapping",
      scopeKind: "company",
      scopeId: "co_1",
      externalId: "paperclip:company:co_1",
      title: "Paperclip",
      status: "missing",
      data: {
        companyId: "co_1",
        workspaceId: null,
      },
    });

    const result = await harness.performAction<Record<string, unknown>>("repair-mappings", {
      companyId: "co_1",
    });
    expect(result.repaired).toBeGreaterThan(0);

    const workspaceMappings = await harness.ctx.entities.list({
      entityType: "honcho-workspace-mapping",
      scopeKind: "company",
      scopeId: "co_1",
      externalId: "paperclip:company:co_1",
    });
    expect(workspaceMappings[0]?.data).toMatchObject({
      workspaceId: "paperclip_co_1",
    });
  });
});
