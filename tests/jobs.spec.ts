import { afterEach, describe, expect, it, vi } from "vitest";
import { setMigrationCandidatesLoaderForTests } from "../src/sync.js";
import plugin from "../src/worker.js";
import { createHonchoHarness, installFetchMock, requestsMatching } from "./helpers.js";

afterEach(() => {
  setMigrationCandidatesLoaderForTests(null);
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

  it("continues using the stored workspace mapping even if workspacePrefix changes later", async () => {
    const { requests } = installFetchMock();
    const harness = createHonchoHarness({
      config: {
        workspacePrefix: "renamed",
      },
    });

    await harness.ctx.entities.upsert({
      entityType: "honcho-workspace-mapping",
      scopeKind: "company",
      scopeId: "co_1",
      externalId: "paperclip:company:co_1",
      title: "Paperclip",
      status: "mapped",
      data: {
        companyId: "co_1",
        workspaceId: "paperclip_co_1",
        workspacePrefix: "paperclip",
        updatedAt: new Date().toISOString(),
      },
    });

    await plugin.definition.setup(harness.ctx);
    await harness.executeTool("honcho_get_issue_context", { issueId: "iss_1" }, {
      companyId: "co_1",
      projectId: "proj_1",
      agentId: "agent_1",
      runId: "run_1",
    });

    const contextRequest = requestsMatching(requests, "/context?")[0];
    expect(contextRequest?.url).toContain("/v3/workspaces/paperclip_co_1/");
    expect(contextRequest?.url).not.toContain("/v3/workspaces/renamed_co_1/");
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
      warnings: [],
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
        peer_id: "agent_agent-one",
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
      id: "agent_agent-one",
      configuration: expect.any(Object),
    });
    expect(peerRequest?.body).not.toHaveProperty("config");

    const sessionRequest = requestsMatching(requests, "/sessions").find((request) => request.body?.id === "PAP-1");
    expect(sessionRequest?.body).toMatchObject({
      id: "PAP-1",
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

  it("migration-import maps agent profile files to agent peers instead of owner peers", async () => {
    const { requests } = installFetchMock();
    const harness = createHonchoHarness();

    setMigrationCandidatesLoaderForTests(async () => [{
      sourceType: "agent_profile_files",
      issueId: null,
      issueIdentifier: null,
      sourceId: "agent-profile-1",
      fingerprint: "agent-profile:fingerprint",
      authorType: "agent",
      authorId: "agent_1",
      createdAt: new Date("2026-03-15T12:04:00.000Z").toISOString(),
      content: "Agent profile memory",
      title: "agent-profile.md",
      workspaceId: "paperclip_co_1",
      projectId: "proj_1",
      sourceCategory: "agent-profile",
      metadata: {
        authorId: "agent:agent_1",
        relativePath: "profiles/agent-one.md",
      },
    }]);

    await plugin.definition.setup(harness.ctx);
    await harness.runJob("migration-import");

    const peerMappings = await harness.ctx.entities.list({
      entityType: "honcho-peer-mapping",
      scopeKind: "company",
      scopeId: "co_1",
    });
    expect(peerMappings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        externalId: "paperclip:agent:agent_1",
        data: expect.objectContaining({
          peerId: "agent_agent-one",
          peerType: "agent",
        }),
      }),
    ]));

    const peerRequest = requestsMatching(requests, "/peers").find((request) => request.body?.id === "agent_agent-one");
    expect(peerRequest?.body).toMatchObject({
      id: "agent_agent-one",
      metadata: expect.objectContaining({
        agent_id: "agent_1",
      }),
    });
    expect(peerRequest?.body?.metadata).not.toHaveProperty("owner_id");

    const messageRequest = requestsMatching(requests, "/messages")[0];
    const [message] = ((messageRequest?.body?.messages ?? []) as Array<Record<string, unknown>>);
    expect(message).toMatchObject({
      peer_id: "agent_agent-one",
    });
  });

  it("initialize-memory recreates missing workspace/session mappings without reimporting memory", async () => {
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
    await harness.ctx.entities.upsert({
      entityType: "honcho-session-mapping",
      scopeKind: "issue",
      scopeId: "iss_1",
      externalId: "paperclip:issue:iss_1",
      title: "PAP-1",
      status: "missing",
      data: {
        companyId: "co_1",
        issueId: "iss_1",
        issueIdentifier: "PAP-1",
        sessionId: null,
        workspaceId: null,
        issueTitle: "Auth regression",
        issueStatus: "todo",
        updatedAt: new Date().toISOString(),
      },
    });

    await harness.runJob("initialize-memory");

    const workspaceMappings = await harness.ctx.entities.list({
      entityType: "honcho-workspace-mapping",
      scopeKind: "company",
      scopeId: "co_1",
      externalId: "paperclip:company:co_1",
    });
    expect(workspaceMappings[0]?.data).toMatchObject({
      workspaceId: "paperclip_co_1",
    });

    const sessionMappings = await harness.ctx.entities.list({
      entityType: "honcho-session-mapping",
      scopeKind: "issue",
      scopeId: "iss_1",
      externalId: "paperclip:issue:iss_1",
    });
    expect(sessionMappings[0]?.data).toMatchObject({
      sessionId: "PAP-1",
      workspaceId: "paperclip_co_1",
    });
  });

  it("initialize-memory preserves the stored workspace mapping when workspacePrefix changes later", async () => {
    installFetchMock();
    const harness = createHonchoHarness({
      config: {
        workspacePrefix: "renamed",
      },
    });

    await harness.ctx.entities.upsert({
      entityType: "honcho-workspace-mapping",
      scopeKind: "company",
      scopeId: "co_1",
      externalId: "paperclip:company:co_1",
      title: "Paperclip",
      status: "mapped",
      data: {
        companyId: "co_1",
        workspaceId: "paperclip_co_1",
        workspacePrefix: "paperclip",
        updatedAt: new Date().toISOString(),
      },
    });

    await plugin.definition.setup(harness.ctx);
    await harness.runJob("initialize-memory");

    const workspaceMappings = await harness.ctx.entities.list({
      entityType: "honcho-workspace-mapping",
      scopeKind: "company",
      scopeId: "co_1",
      externalId: "paperclip:company:co_1",
    });
    expect(workspaceMappings[0]?.data).toMatchObject({
      workspaceId: "paperclip_co_1",
      workspacePrefix: "paperclip",
    });
    expect(workspaceMappings[0]?.data).not.toMatchObject({
      workspaceId: "renamed_co_1",
      workspacePrefix: "renamed",
    });
  });
});
