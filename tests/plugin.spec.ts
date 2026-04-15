import { afterEach, describe, expect, it, vi } from "vitest";
import { peerIdForAgent } from "../src/ids.js";
import plugin from "../src/worker.js";
import { createHonchoHarness, installFetchMock } from "./helpers.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const firstAgentPeerId = peerIdForAgent("agent_1", "Agent One");

describe("@honcho-ai/paperclip-honcho smoke", () => {
  it("covers the expected end-to-end plugin pipeline", async () => {
    installFetchMock();
    const harness = createHonchoHarness({
      config: {
        enablePeerChat: true,
      },
    });

    await plugin.definition.setup(harness.ctx);

    await harness.emit("issue.comment.created", { commentId: "c_2" }, {
      entityId: "iss_1",
      entityType: "issue",
      companyId: "co_1",
    });
    await harness.emit("issue.updated", { key: "design" }, {
      entityId: "iss_1",
      entityType: "issue",
      companyId: "co_1",
    });

    const contextResult = await harness.executeTool("honcho_get_issue_context", { issueId: "iss_1" }, {
      companyId: "co_1",
      projectId: "proj_1",
      agentId: "agent_1",
      runId: "run_1",
    });
    const searchResult = await harness.executeTool("honcho_search_memory", { query: "auth regression", issueId: "iss_1" }, {
      companyId: "co_1",
      projectId: "proj_1",
      agentId: "agent_1",
      runId: "run_1",
    });
    const askResult = await harness.executeTool("honcho_ask_peer", {
      targetPeerId: firstAgentPeerId,
      query: "What happened?",
      issueId: "iss_1",
    }, {
      companyId: "co_1",
      projectId: "proj_1",
      agentId: "agent_1",
      runId: "run_1",
    });

    expect(contextResult.content).toContain("Investigating auth regression");
    expect(searchResult.content).toContain("Relevant memory hit");
    expect(askResult.content).toContain("Peer answer");

    const status = await harness.getData<Record<string, unknown>>("issue-memory-status", {
      issueId: "iss_1",
      companyId: "co_1",
    });
    expect(status.issueId).toBe("iss_1");

    await harness.performAction("resync-issue", { issueId: "iss_1", companyId: "co_1" });
    await harness.runJob("initialize-memory");
    const connection = await harness.performAction<Record<string, unknown>>("test-connection");
    expect(connection.ok).toBe(true);

    const memoryStatus = await harness.getData<Record<string, unknown>>("memory-status", {
      companyId: "co_1",
    });
    expect(memoryStatus.companyStatus).toMatchObject({
      initializationStatus: "complete",
    });
  });
});
