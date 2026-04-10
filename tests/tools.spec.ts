import { afterEach, describe, expect, it, vi } from "vitest";
import plugin from "../src/worker.js";
import { createHonchoHarness, installFetchMock, requestsMatching } from "./helpers.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("honcho tools", () => {
  it("requires issue context for honcho_get_issue_context", async () => {
    installFetchMock();
    const harness = createHonchoHarness();

    await plugin.definition.setup(harness.ctx);

    const result = await harness.executeTool("honcho_get_issue_context", {}, {
      companyId: "co_1",
      projectId: "proj_1",
      agentId: "agent_1",
      runId: "run_1",
    });

    expect(result.error).toBe("issueId is required");
  });

  it("uses the v3 session context endpoint with summary mode and a user peer target", async () => {
    const { requests } = installFetchMock();
    const harness = createHonchoHarness();

    await plugin.definition.setup(harness.ctx);

    const result = await harness.executeTool("honcho_get_issue_context", { issueId: "iss_1" }, {
      companyId: "co_1",
      projectId: "proj_1",
      agentId: "agent_1",
      runId: "run_1",
    });

    expect(result.content).toContain("Investigating auth regression");
    const contextRequest = requestsMatching(requests, "/context?")[0];
    expect(contextRequest?.url).toContain("/v3/workspaces/paperclip_co_1/sessions/issue_iss_1/context?");
    expect(contextRequest?.url).toContain("summary=true");
    expect(contextRequest?.url).toContain("tokens=2000");
    expect(contextRequest?.url).toContain("peer_target=user_user_1");
  });

  it("uses workspace scope by default when no issue context is present", async () => {
    const { requests } = installFetchMock();
    const harness = createHonchoHarness();

    await plugin.definition.setup(harness.ctx);

    const result = await harness.executeTool("honcho_search_memory", { query: "auth regression" }, {
      companyId: "co_1",
      projectId: "proj_1",
      agentId: "agent_1",
      runId: "run_1",
    });

    expect(result.content).toContain("Relevant memory hit");
    const representationRequest = requestsMatching(requests, "/representation")[0];
    expect(representationRequest?.body).toMatchObject({
      search_query: "auth regression",
      search_top_k: 5,
    });
    const peerRequest = requestsMatching(requests, "/peers")[0];
    expect(peerRequest?.body).toMatchObject({
      configuration: {
        observe_me: true,
        observe_others: true,
      },
    });
    expect(representationRequest?.body).not.toHaveProperty("session_id");
    expect(representationRequest?.body).not.toHaveProperty("target");
  });

  it("allows agent peer observation to be enabled explicitly", async () => {
    const { requests } = installFetchMock();
    const harness = createHonchoHarness({
      config: {
        observe_me: true,
        observe_others: true,
      },
    });

    await plugin.definition.setup(harness.ctx);

    await harness.executeTool("honcho_search_memory", { query: "auth regression" }, {
      companyId: "co_1",
      projectId: "proj_1",
      agentId: "agent_1",
      runId: "run_1",
    });

    const peerRequest = requestsMatching(requests, "/peers")[0];
    expect(peerRequest?.body).toMatchObject({
      configuration: {
        observe_me: true,
        observe_others: true,
      },
    });
  });

  it("defaults search to the current issue session and honors explicit workspace overrides", async () => {
    const { requests } = installFetchMock();
    const harness = createHonchoHarness();

    await plugin.definition.setup(harness.ctx);

    await harness.executeTool("honcho_search_memory", { query: "auth regression", issueId: "iss_1" }, {
      companyId: "co_1",
      projectId: "proj_1",
      agentId: "agent_1",
      runId: "run_1",
    });
    await harness.executeTool("honcho_search_memory", { query: "auth regression", issueId: "iss_1", scope: "workspace" }, {
      companyId: "co_1",
      projectId: "proj_1",
      agentId: "agent_1",
      runId: "run_1",
    });

    const representationRequests = requestsMatching(requests, "/representation");
    expect(representationRequests).toHaveLength(2);
    expect(representationRequests[0]?.body).toMatchObject({
      session_id: "issue_iss_1",
      target: "issue_iss_1",
    });
    expect(representationRequests[1]?.body).not.toHaveProperty("session_id");
    expect(representationRequests[1]?.body).not.toHaveProperty("target");
  });

  it("does not register honcho_ask_peer when peer chat is disabled", async () => {
    installFetchMock();
    const harness = createHonchoHarness({
      config: {
        enablePeerChat: false,
      },
    });

    await plugin.definition.setup(harness.ctx);

    await expect(
      harness.executeTool("honcho_ask_peer", { targetPeerId: "agent_agent_1", query: "Status?", issueId: "iss_1" }, {
        companyId: "co_1",
        projectId: "proj_1",
        agentId: "agent_1",
        runId: "run_1",
      }),
    ).rejects.toThrow("No tool handler registered");
  });

  it("registers and executes honcho_ask_peer when peer chat is enabled", async () => {
    installFetchMock();
    const harness = createHonchoHarness({
      config: {
        enablePeerChat: true,
      },
    });

    await plugin.definition.setup(harness.ctx);

    const result = await harness.executeTool("honcho_ask_peer", {
      targetPeerId: "agent_agent_1",
      query: "Status?",
      issueId: "iss_1",
    }, {
      companyId: "co_1",
      projectId: "proj_1",
      agentId: "agent_1",
      runId: "run_1",
    });

    expect(result.content).toContain("Peer answer");
  });

  it("registers the expanded Honcho retrieval tool surface", async () => {
    installFetchMock();
    const harness = createHonchoHarness();

    await plugin.definition.setup(harness.ctx);

    const workspaceResult = await harness.executeTool("honcho_get_workspace_context", { query: "auth regression" }, {
      companyId: "co_1",
      projectId: "proj_1",
      agentId: "agent_1",
      runId: "run_1",
    });
    const sessionResult = await harness.executeTool("honcho_get_session", { issueId: "iss_1" }, {
      companyId: "co_1",
      projectId: "proj_1",
      agentId: "agent_1",
      runId: "run_1",
    });
    const agentResult = await harness.executeTool("honcho_get_agent_context", { agentId: "agent_1", issueId: "iss_1" }, {
      companyId: "co_1",
      projectId: "proj_1",
      agentId: "agent_1",
      runId: "run_1",
    });
    const hierarchyResult = await harness.executeTool("honcho_get_hierarchy_context", {}, {
      companyId: "co_1",
      projectId: "proj_1",
      agentId: "agent_1",
      runId: "run_1",
    });

    expect(workspaceResult.content).toContain("Relevant memory hit");
    expect(sessionResult.content).toContain("Investigating auth regression");
    expect(agentResult.content).toContain("Relevant memory hit");
    expect(hierarchyResult.content).toContain("Hierarchy context unavailable");
  });

  it("keeps message search and conclusions search distinct", async () => {
    const { requests } = installFetchMock();
    const harness = createHonchoHarness();

    await plugin.definition.setup(harness.ctx);

    await harness.executeTool("honcho_search_messages", { query: "auth regression", issueId: "iss_1" }, {
      companyId: "co_1",
      projectId: "proj_1",
      agentId: "agent_1",
      runId: "run_1",
    });
    await harness.executeTool("honcho_search_conclusions", { query: "auth regression", issueId: "iss_1" }, {
      companyId: "co_1",
      projectId: "proj_1",
      agentId: "agent_1",
      runId: "run_1",
    });

    const representationRequests = requestsMatching(requests, "/representation");
    expect(representationRequests).toHaveLength(2);
    expect(representationRequests[0]?.body).not.toHaveProperty("summary_only");
    expect(representationRequests[1]?.body).toMatchObject({
      summary_only: true,
    });
  });
});
