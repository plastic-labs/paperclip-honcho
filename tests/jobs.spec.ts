import { PLUGIN_RPC_ERROR_CODES } from "@paperclipai/plugin-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACTION_KEYS, DATA_KEYS, ENTITY_TYPES, JOB_KEYS } from "../src/constants.js";
import { peerIdForAgent, workspaceIdForCompany } from "../src/ids.js";
import { importMigrationPreview, initializeMemory, scanMigrationSources, setMigrationCandidatesLoaderForTests } from "../src/sync.js";
import type { InitializationReport, MemoryStatusData, MigrationJobStatusData } from "../src/types.js";
import plugin from "../src/worker.js";
import { buildDefaultFixtures, createHonchoHarness, installFetchMock, requestsMatching, type CapturedRequest } from "./helpers.js";

afterEach(() => {
  setMigrationCandidatesLoaderForTests(null);
  vi.restoreAllMocks();
});

const companyWorkspaceId = workspaceIdForCompany("co_1", "paperclip", "Paperclip");
const firstAgentPeerId = peerIdForAgent("agent_1", "Agent One");

function appendedMessageCount(requests: CapturedRequest[]): number {
  return requestsMatching(requests, "/messages")
    .filter((request) => Array.isArray(request.body?.messages))
    .reduce((total, request) => total + (request.body!.messages as unknown[]).length, 0);
}

describe("honcho memory jobs", () => {
  it("initialize-memory creates company memory state, mappings, and an initialization report", async () => {
    installFetchMock();
    const harness = createHonchoHarness();

    await plugin.definition.setup(harness.ctx);
    await harness.performAction(ACTION_KEYS.initializeMemoryForCompany, { companyId: "co_1" });

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

    await expect(harness.performAction(ACTION_KEYS.initializeMemoryForCompany, { companyId: "co_1" })).rejects.toThrow("Honcho API key is required");

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

  it("keeps syncing to a previously stored workspace even after the configured prefix changes", async () => {
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
    await harness.performAction("resync-issue", { issueId: "iss_1", companyId: "co_1" });

    // The stored mapping is canonical forever: a config/company-name change
    // must never redirect existing sync traffic at a different workspace.
    expect(requestsMatching(requests, "/workspaces/paperclip_co_1/")).not.toHaveLength(0);
    expect(requestsMatching(requests, `/workspaces/${companyWorkspaceId}/`)).toHaveLength(0);
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
    await harness.performAction(ACTION_KEYS.initializeMemoryForCompany, { companyId: "co_1" });

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
    await harness.performAction(ACTION_KEYS.initializeMemoryForCompany, { companyId: "co_1" });

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
    await scanMigrationSources(harness.ctx, "co_1");

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
      issues: [
        {
          issueId: "iss_1",
          issueIdentifier: "PAP-1",
          issueTitle: "Fix auth regression",
          commentCount: 2,
          documentCount: 1,
          estimatedMessages: 3,
        },
      ],
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
    await scanMigrationSources(harness.ctx, "co_1");
    await importMigrationPreview(harness.ctx, "co_1");

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
        peer_id: firstAgentPeerId,
        metadata: expect.objectContaining({
          contentType: "issue_document_section",
          documentRevisionId: "rev_2",
        }),
      }),
    ]));
  });

  it("migration-import skips candidates already present in the Honcho session and backfills the ledger", async () => {
    const { requests } = installFetchMock({
      existingSessionMessages: {
        [`${companyWorkspaceId}/PAP-1`]: [
          {
            id: "msg_existing_comment",
            metadata: {
              commentId: "c_1",
              contentType: "issue_comment",
            },
          },
          {
            id: "msg_existing_document",
            metadata: {
              documentRevisionId: "rev_2",
              sectionKey: "design:r2:s0",
              contentType: "issue_document_section",
            },
          },
        ],
      },
    });
    const harness = createHonchoHarness();

    await plugin.definition.setup(harness.ctx);
    await scanMigrationSources(harness.ctx, "co_1");
    await importMigrationPreview(harness.ctx, "co_1");

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

    const listRequests = requestsMatching(requests, "/messages/list");
    expect(listRequests).toHaveLength(1);

    const appendRequests = requestsMatching(requests, "/messages").filter((request) => !request.url.endsWith("/messages/list"));
    const appendedMessages = appendRequests.flatMap((request) => (request.body?.messages ?? []) as Array<Record<string, unknown>>);
    expect(appendedMessages).toHaveLength(1);
    expect(appendedMessages[0]?.metadata).toMatchObject({
      commentId: "c_2",
      contentType: "issue_comment",
    });
  });

  it("uses Honcho-safe ids and payload field names during initialization", async () => {
    const { requests } = installFetchMock();
    const harness = createHonchoHarness();

    await plugin.definition.setup(harness.ctx);
    await harness.performAction(ACTION_KEYS.initializeMemoryForCompany, { companyId: "co_1" });

    const workspaceRequest = requestsMatching(requests, "/v3/workspaces")[0];
    expect(workspaceRequest?.body).toMatchObject({
      id: companyWorkspaceId,
    });
    expect(workspaceRequest?.body).not.toHaveProperty("metadata");

    const peerRequest = requestsMatching(requests, "/peers")[0];
    expect(peerRequest?.body).toMatchObject({
      id: firstAgentPeerId,
      configuration: expect.any(Object),
    });
    expect(peerRequest?.body).not.toHaveProperty("config");

    const sessionRequest = requestsMatching(requests, "/sessions").find((request) => request.body?.id === "PAP-1");
    expect(sessionRequest?.body).toMatchObject({
      id: "PAP-1",
    });

    const messageRequest = requestsMatching(requests, "/messages").find((request) => !request.url.includes("/messages/list"));
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
    await harness.performAction(ACTION_KEYS.initializeMemoryForCompany, { companyId: "co_1" });

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
    await scanMigrationSources(harness.ctx, "co_1");
    await importMigrationPreview(harness.ctx, "co_1");
    const messageRequestsAfterFirstImport = requestsMatching(requests, "/messages").length;
    await importMigrationPreview(harness.ctx, "co_1");

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

  it("migration skips issue memory that was already synced through issue events", async () => {
    const { requests } = installFetchMock();
    const harness = createHonchoHarness();

    await plugin.definition.setup(harness.ctx);
    await harness.emit("issue.comment.created", { commentId: "c_2" }, {
      entityId: "iss_1",
      entityType: "issue",
      companyId: "co_1",
    });

    expect(requestsMatching(requests, "/messages")).toHaveLength(1);

    await scanMigrationSources(harness.ctx, "co_1");

    const preview = await harness.getData<Record<string, unknown>>("migration-preview", {
      companyId: "co_1",
    });
    expect(preview).toMatchObject({
      totals: {
        comments: 0,
        documents: 0,
        files: 0,
      },
      estimatedMessages: 0,
    });

    await importMigrationPreview(harness.ctx, "co_1");

    expect(requestsMatching(requests, "/messages")).toHaveLength(1);
  });

  it("initialization uses readable workspace and agent peer ids without workspace metadata", async () => {
    const { requests } = installFetchMock();
    const harness = createHonchoHarness();

    await plugin.definition.setup(harness.ctx);
    await harness.performAction(ACTION_KEYS.initializeMemoryForCompany, { companyId: "co_1" });

    const workspaceRequest = requestsMatching(requests, "/v3/workspaces")[0];
    expect(workspaceRequest?.body).toMatchObject({
      id: companyWorkspaceId,
    });
    expect(workspaceRequest?.body).not.toHaveProperty("metadata");

    const agentPeerRequest = requestsMatching(requests, "/peers").find((request) => request.body?.id === firstAgentPeerId);
    expect(agentPeerRequest?.body).toMatchObject({
      id: firstAgentPeerId,
      metadata: expect.objectContaining({
        agent_name: "Agent One",
      }),
    });
  });

  it("keeps an agent's peer id stable after the agent is renamed", async () => {
    const { requests } = installFetchMock();
    const harness = createHonchoHarness();

    await plugin.definition.setup(harness.ctx);
    await harness.performAction(ACTION_KEYS.initializeMemoryForCompany, { companyId: "co_1" });

    const renamedAgentPeerId = peerIdForAgent("agent_1", "Renamed Agent");
    expect(renamedAgentPeerId).not.toBe(firstAgentPeerId);

    harness.seed({
      agents: [{
        ...(await harness.ctx.agents.get("agent_1", "co_1"))!,
        name: "Renamed Agent",
      }],
    });

    await harness.performAction(ACTION_KEYS.initializeMemoryForCompany, { companyId: "co_1" });

    expect(requestsMatching(requests, "/peers").some((request) => request.body?.id === renamedAgentPeerId)).toBe(false);
    const peerMappings = await harness.ctx.entities.list({
      entityType: "honcho-peer-mapping",
      scopeKind: "company",
      scopeId: "co_1",
      externalId: "paperclip:agent:agent_1",
    });
    expect(peerMappings[0]?.data).toMatchObject({ peerId: firstAgentPeerId });
  });

  it("imports a source exactly once even when the candidate list is duplicated and the ledger is unavailable", async () => {
    const { requests } = installFetchMock();
    const harness = createHonchoHarness();

    // Simulate the real failure mode: the per-job invocation scope makes the
    // import ledger unavailable (reads empty, writes throw), so the ledger
    // cannot dedup. Everything else (Honcho appends, session provenance) works.
    const realList = harness.ctx.entities.list.bind(harness.ctx.entities);
    const realUpsert = harness.ctx.entities.upsert.bind(harness.ctx.entities);
    harness.ctx.entities.list = (async (params: Parameters<typeof realList>[0]) =>
      params.entityType === "honcho-import-ledger" ? [] : realList(params)) as typeof realList;
    harness.ctx.entities.upsert = (async (input: Parameters<typeof realUpsert>[0]) => {
      if (input.entityType === "honcho-import-ledger") throw new Error("invocation scope expired");
      return realUpsert(input);
    }) as typeof realUpsert;

    // The same comment appears twice in the candidate list (e.g. a host that
    // repeats issue-list pages). It must still import exactly once.
    const comment = {
      sourceType: "issue_comments" as const,
      issueId: "iss_1",
      issueIdentifier: "PAP-1",
      sourceId: "c_dup",
      fingerprint: "fp_c_dup",
      authorType: "user" as const,
      authorId: "user_1",
      createdAt: new Date("2026-03-15T12:05:00.000Z").toISOString(),
      content: "A duplicated historical comment that must import exactly once.",
      title: "PAP-1",
      metadata: { commentId: "c_dup", issueId: "iss_1", companyId: "co_1" },
    };
    setMigrationCandidatesLoaderForTests(async () => [comment, { ...comment }]);

    await plugin.definition.setup(harness.ctx);
    await importMigrationPreview(harness.ctx, "co_1");

    const appendedMessages = requestsMatching(requests, "/messages")
      .filter((request) => Array.isArray(request.body?.messages))
      .reduce((total, request) => total + (request.body!.messages as unknown[]).length, 0);
    expect(appendedMessages).toBe(1);
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
    await importMigrationPreview(harness.ctx, "co_1");

    const peerMappings = await harness.ctx.entities.list({
      entityType: "honcho-peer-mapping",
      scopeKind: "company",
      scopeId: "co_1",
    });
    expect(peerMappings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        externalId: "paperclip:agent:agent_1",
        data: expect.objectContaining({
          peerId: firstAgentPeerId,
          peerType: "agent",
        }),
      }),
    ]));

    const peerRequest = requestsMatching(requests, "/peers").find((request) => request.body?.id === firstAgentPeerId);
    expect(peerRequest?.body).toMatchObject({
      id: firstAgentPeerId,
      metadata: expect.objectContaining({
        agent_id: "agent_1",
      }),
    });
    expect(peerRequest?.body?.metadata).not.toHaveProperty("owner_id");
  });

  it("initialize-memory recreates missing workspace/session mappings without reimporting memory", async () => {
    installFetchMock();
    const harness = createHonchoHarness();

    await plugin.definition.setup(harness.ctx);
    await harness.performAction(ACTION_KEYS.initializeMemoryForCompany, { companyId: "co_1" });

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

    await harness.performAction(ACTION_KEYS.initializeMemoryForCompany, { companyId: "co_1" });

    const workspaceMappings = await harness.ctx.entities.list({
      entityType: "honcho-workspace-mapping",
      scopeKind: "company",
      scopeId: "co_1",
      externalId: "paperclip:company:co_1",
    });
    expect(workspaceMappings[0]?.data).toMatchObject({
      workspaceId: companyWorkspaceId,
    });

    const sessionMappings = await harness.ctx.entities.list({
      entityType: "honcho-session-mapping",
      scopeKind: "issue",
      scopeId: "iss_1",
      externalId: "paperclip:issue:iss_1",
    });
    expect(sessionMappings[0]?.data).toMatchObject({
      sessionId: "PAP-1",
      workspaceId: companyWorkspaceId,
    });
  });

  it("initialize-memory never migrates an existing stored workspace mapping", async () => {
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
    await harness.performAction(ACTION_KEYS.initializeMemoryForCompany, { companyId: "co_1" });

    const workspaceMappings = await harness.ctx.entities.list({
      entityType: "honcho-workspace-mapping",
      scopeKind: "company",
      scopeId: "co_1",
      externalId: "paperclip:company:co_1",
    });
    // A company rename or a workspacePrefix config change must never redirect
    // an already-established mapping to a different Honcho workspace, or the
    // company's accumulated memory under the old id becomes unreachable.
    expect(workspaceMappings[0]?.data).toMatchObject({
      workspaceId: "paperclip_co_1",
      workspacePrefix: "paperclip",
    });
    expect(workspaceMappings[0]?.data.workspaceId).not.toBe(companyWorkspaceId);

    const status = await harness.getData<Record<string, unknown>>("memory-status", {
      companyId: "co_1",
    });
    expect(status.companyStatus).toMatchObject({
      initializationStatus: "complete",
      lastError: null,
    });
  });

  // #20: Paperclip admits company-scoped worker->host calls only inside an
  // invocation that carries the company. performAction and getData carry one;
  // runJob carries none, so initialization that waited for the job never ran.
  it("initializes memory inside the action, which the host scopes to the company", async () => {
    installFetchMock();
    // One more agent and issue than a host page holds, so mapping has to paginate.
    const agents = Array.from({ length: 101 }, (_, index) => ({
      ...buildDefaultFixtures().agents[0]!,
      id: `agent_${index + 1}`,
      name: `Agent ${index + 1}`,
      urlKey: `agent-${index + 1}`,
    }));
    const issues = Array.from({ length: 101 }, (_, index) => ({
      ...buildDefaultFixtures().issues[0]!,
      id: `iss_${index + 1}`,
      identifier: `PAP-${index + 1}`,
    }));
    const harness = createHonchoHarness({ seed: { agents, issues } });
    // Like current hosts: issues.list applies limit/offset in SQL and then the
    // same window again to the returned rows, so an offset > 0 comes back empty.
    const listIssues = harness.ctx.issues.list.bind(harness.ctx.issues);
    harness.ctx.issues.list = async (input) => {
      const offset = input.offset ?? 0;
      return (await listIssues(input)).slice(offset, input.limit === undefined ? undefined : offset + input.limit);
    };
    let scopedCompanyId: string | null = null;
    const getConfig = harness.ctx.config.get.bind(harness.ctx.config);
    harness.ctx.config.get = async (companyId?: string) => {
      if (!scopedCompanyId) {
        throw new Error('Plugin "honcho" is not allowed to perform "config.get": company context is required');
      }
      return await getConfig(companyId);
    };
    const asCompany = async <T>(work: () => Promise<T>): Promise<T> => {
      scopedCompanyId = "co_1";
      try {
        return await work();
      } finally {
        scopedCompanyId = null;
      }
    };

    await plugin.definition.setup(harness.ctx);
    await asCompany(() => harness.performAction(ACTION_KEYS.initializeMemoryForCompany, {}, { companyId: "co_1" }));
    // The settings page still triggers the job afterwards; with nothing queued it does nothing.
    await expect(harness.runJob(JOB_KEYS.initializeMemory)).resolves.toBeUndefined();

    // What the settings page polls and shows once activation finishes.
    const jobStatus = await asCompany(() => harness.getData<MigrationJobStatusData>(DATA_KEYS.migrationJobStatus, { companyId: "co_1" }));
    expect(jobStatus.checkpoint).toMatchObject({ activeJobKey: JOB_KEYS.initializeMemory, status: "complete" });
    const status = await asCompany(() => harness.getData<MemoryStatusData>(DATA_KEYS.memoryStatus, { companyId: "co_1" }));
    expect(status.companyStatus).toMatchObject({ initializationStatus: "complete", migrationStatus: "complete" });
    const agentPeerMappings = (await harness.ctx.entities.list({ entityType: ENTITY_TYPES.peerMapping, limit: 1000 }))
      .filter((record) => record.externalId?.startsWith("paperclip:agent:"));
    expect(agentPeerMappings).toHaveLength(101);
    expect(await harness.ctx.entities.list({ entityType: ENTITY_TYPES.sessionMapping, limit: 1000 })).toHaveLength(101);
  });

  // The host fails an action after 30 s, so initialization stops at a deadline
  // and the settings page calls it again. Each call must pick up where the
  // last one stopped, and nothing may be imported twice.
  it("resumes an initialization that stopped at its deadline without importing anything twice", async () => {
    const { requests } = installFetchMock();
    // The document's latest revision predates the comments, so once it is
    // imported it sits ahead of the work that is left.
    const documentRevisions = buildDefaultFixtures().documentRevisions.map((revision) =>
      revision.id === "rev_2" ? { ...revision, createdAt: new Date("2026-03-15T12:00:30.000Z") } : revision);
    const harness = createHonchoHarness({ seed: { documentRevisions } });
    let commentReads = 0;
    const listComments = harness.ctx.issues.listComments.bind(harness.ctx.issues);
    harness.ctx.issues.listComments = async (...args) => {
      commentReads += 1;
      return await listComments(...args);
    };
    await plugin.definition.setup(harness.ctx);

    // With the deadline already past, each call maps or imports one item and stops.
    let calls = 0;
    let report: InitializationReport | null = null;
    while (!report && calls < 20) {
      calls += 1;
      ({ report } = await initializeMemory(harness.ctx, "co_1", { deadline: 0 }));
    }

    expect(calls).toBeGreaterThan(3);
    // Later calls go on from where earlier ones stopped instead of re-reading the issue.
    expect(commentReads).toBe(1);
    const status = await harness.getData<MemoryStatusData>(DATA_KEYS.memoryStatus, { companyId: "co_1" });
    expect(status.companyStatus).toMatchObject({ initializationStatus: "complete", migrationStatus: "complete" });
    const imported = report!.importSummary.comments + report!.importSummary.documents;
    expect(imported).toBeGreaterThan(2);
    expect(appendedMessageCount(requests)).toBe(imported);
  });

  // When the host gives up on an action call it refuses the worker's remaining
  // company-scoped calls for it. What the call already imported must still be
  // recorded on the issue, or the next event sync appends it again.
  it("records imported comments on the issue when the host gives up on the call", async () => {
    const { requests } = installFetchMock();
    const harness = createHonchoHarness();
    await plugin.definition.setup(harness.ctx);
    let hostGaveUp = false;
    let appendsBeforeGivingUp = 1;
    const fetch = harness.ctx.http.fetch.bind(harness.ctx.http);
    harness.ctx.http.fetch = async (url, init) => {
      const response = await fetch(url, init);
      if (url.endsWith("/messages") && init?.method === "POST" && --appendsBeforeGivingUp === 0) hostGaveUp = true;
      return response;
    };
    const state = harness.ctx.state;
    for (const method of ["get", "set"] as const) {
      const original = state[method].bind(state) as (...args: unknown[]) => Promise<unknown>;
      (state as unknown as Record<string, unknown>)[method] = async (key: { scopeKind: string }, ...rest: unknown[]) => {
        if (hostGaveUp && key.scopeKind === "company") throw new Error("unknown invocation scope");
        return await original(key, ...rest);
      };
    }

    await expect(initializeMemory(harness.ctx, "co_1", { deadline: Date.now() + 60_000 })).rejects.toThrow("unknown invocation scope");
    hostGaveUp = false;
    await harness.emit("issue.comment.created", { commentId: "c_2" }, { entityId: "iss_1", entityType: "issue", companyId: "co_1" });

    const appendedCommentIds = requestsMatching(requests, "/messages")
      .flatMap((request) => (request.body?.messages as Array<{ metadata?: { commentId?: string } }> | undefined) ?? [])
      .map((message) => message.metadata?.commentId)
      .filter(Boolean);
    expect(appendedCommentIds).toEqual(["c_1", "c_2"]);
  });

  // A comment whose import the host refused (it gave up on the call) or that
  // Honcho failed must not be lost: later comments on its issue would move the
  // issue's sync cursor past it, and nothing would import it again.
  it("retries a comment the host refused or Honcho failed instead of losing it", async () => {
    const { requests } = installFetchMock();
    const issueComments = [1, 2, 3, 4].map((n) => ({
      ...buildDefaultFixtures().issueComments[0]!,
      id: `c_${n}`,
      body: `Comment number ${n}`,
      createdAt: new Date(`2026-03-15T12:0${n}:00.000Z`),
      updatedAt: new Date(`2026-03-15T12:0${n}:00.000Z`),
    }));
    const harness = createHonchoHarness({ seed: { issueComments, issueDocuments: [], documentRevisions: [] } });
    await plugin.definition.setup(harness.ctx);
    let appends = 0;
    let refuseCompanyRead = false;
    const fetch = harness.ctx.http.fetch.bind(harness.ctx.http);
    harness.ctx.http.fetch = async (url, init) => {
      if (url.endsWith("/messages") && init?.method === "POST") {
        appends += 1;
        // The host gives up on the call right after c_1 is appended.
        if (appends === 1) refuseCompanyRead = true;
        // c_3 fails once.
        if (appends === 3) return new Response(JSON.stringify({ error: "forced failure" }), { status: 500 });
      }
      return await fetch(url, init);
    };
    const getCompany = harness.ctx.companies.get.bind(harness.ctx.companies);
    harness.ctx.companies.get = async (companyId) => {
      if (refuseCompanyRead) {
        refuseCompanyRead = false;
        throw Object.assign(new Error("unknown invocation scope"), { code: PLUGIN_RPC_ERROR_CODES.INVOCATION_SCOPE_DENIED });
      }
      return await getCompany(companyId);
    };
    const migrationStatus = async () =>
      (await harness.getData<MemoryStatusData>(DATA_KEYS.memoryStatus, { companyId: "co_1" })).companyStatus?.migrationStatus;

    const deadline = () => Date.now() + 60_000;
    expect((await initializeMemory(harness.ctx, "co_1", { deadline: deadline() })).report).toBeNull();
    expect((await initializeMemory(harness.ctx, "co_1", { deadline: deadline() })).report?.importSummary.failed).toBe(2);
    expect(await migrationStatus()).toBe("partial");
    expect((await initializeMemory(harness.ctx, "co_1", { deadline: deadline() })).report?.importSummary.failed).toBe(0);
    expect(await migrationStatus()).toBe("complete");

    const appendedCommentIds = requestsMatching(requests, "/messages")
      .flatMap((request) => (request.body?.messages as Array<{ metadata?: { commentId?: string } }> | undefined) ?? [])
      .map((message) => message.metadata?.commentId);
    expect(appendedCommentIds).toEqual(["c_1", "c_2", "c_3", "c_4"]);
  });

  // Initialization can take many calls. A document edited in between and synced
  // by an issue event belongs to that sync: the import must not append the
  // older revision it collected or move the issue's document cursor back to it.
  it("leaves a document an issue event synced mid-initialization to that sync", async () => {
    const { requests } = installFetchMock();
    const documentRevisions = buildDefaultFixtures().documentRevisions;
    const harness = createHonchoHarness({ seed: { documentRevisions } });
    await plugin.definition.setup(harness.ctx);
    const scope = { entityId: "iss_1", entityType: "issue" as const, companyId: "co_1" };

    // With the deadline past, each call maps or imports one item, so the call
    // that imports the first comment stops before the document.
    for (let calls = 0; appendedMessageCount(requests) === 0 && calls < 10; calls += 1) {
      await initializeMemory(harness.ctx, "co_1", { deadline: 0 });
    }
    documentRevisions.push({ ...documentRevisions[1]!, id: "rev_3", revisionNumber: 3, body: "# Design\n\nRevised chunk three.", createdAt: new Date("2026-03-15T12:04:00.000Z") });
    await harness.emit("issue.comment.created", { commentId: "c_2" }, scope);
    let report: InitializationReport | null = null;
    for (let calls = 0; !report && calls < 10; calls += 1) {
      ({ report } = await initializeMemory(harness.ctx, "co_1", { deadline: 0 }));
    }
    await harness.emit("issue.updated", {}, scope);

    const appendedRevisionIds = requestsMatching(requests, "/messages")
      .flatMap((request) => (request.body?.messages as Array<{ metadata?: { documentRevisionId?: string } }> | undefined) ?? [])
      .map((message) => message.metadata?.documentRevisionId)
      .filter(Boolean);
    expect(report).not.toBeNull();
    expect(appendedRevisionIds).toEqual(["rev_3"]);
  });

  it("refuses a second initialization for a company while one is running", async () => {
    const { requests } = installFetchMock();
    const harness = createHonchoHarness();
    await plugin.definition.setup(harness.ctx);

    const runs = await Promise.allSettled([
      harness.performAction(ACTION_KEYS.initializeMemoryForCompany, { companyId: "co_1" }),
      harness.performAction(ACTION_KEYS.initializeMemoryForCompany, { companyId: "co_1" }),
    ]);

    expect(runs.map((run) => run.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(runs.find((run) => run.status === "rejected")).toMatchObject({
      reason: expect.objectContaining({ message: expect.stringContaining("already running") }),
    });
    const ledger = await harness.ctx.entities.list({ entityType: ENTITY_TYPES.importLedger, limit: 1000 });
    expect(ledger.length).toBeGreaterThan(0);
    expect(appendedMessageCount(requests)).toBe(ledger.length);
  });
});
