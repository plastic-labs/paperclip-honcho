import { describe, expect, it } from "vitest";
import type { Issue, IssueComment } from "@paperclipai/plugin-sdk";
import { hashId, issueEntityUrl, peerIdForAgent, peerIdForUser, sessionIdForIssue, workspaceIdForCompany } from "../src/ids.js";
import { buildWorkspaceId } from "../src/entities.js";
import {
  actorFromComment,
  actorFromDocumentRevision,
  buildCommentProvenance,
  buildDocumentProvenance,
  splitDocumentIntoSections,
} from "../src/provenance.js";
import type { DocumentRevision } from "../src/types.js";

describe("honcho units", () => {
  it("generates deterministic Honcho IDs", () => {
    expect(workspaceIdForCompany("co_1", "paperclip")).toBe("paperclip_co_1");
    expect(sessionIdForIssue("iss_1")).toBe("issue_iss_1");
    expect(sessionIdForIssue("iss_1", "PAP-1")).toBe("PAP-1");
    expect(peerIdForAgent("agent_1")).toBe("agent_agent_1");
    expect(peerIdForUser("user_1")).toBe("user_user_1");
  });

  it("keeps workspace ids readable while avoiding collisions for duplicate company names", () => {
    const first = workspaceIdForCompany("co_1", "paperclip", "Acme");
    const second = workspaceIdForCompany("co_2", "paperclip", "Acme");

    expect(first).toMatch(/^Acme_/);
    expect(second).toMatch(/^Acme_/);
    expect(first).not.toBe(second);
  });

  it("buildWorkspaceId matches the canonical workspace id shape for named companies", () => {
    expect(buildWorkspaceId("co_1", "paperclip", "Acme")).toBe(workspaceIdForCompany("co_1", "paperclip", "Acme"));
  });

  it("keeps agent peer ids readable while avoiding collisions for duplicate agent names", () => {
    const first = peerIdForAgent("agent_1", "Support Bot");
    const second = peerIdForAgent("agent_2", "Support Bot");

    expect(first).toMatch(/^agent_Support_Bot_/);
    expect(second).toMatch(/^agent_Support_Bot_/);
    expect(first).not.toBe(second);
  });

  it("uses a strong deterministic digest for stable id hashing", () => {
    expect(hashId("agent_1")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("builds stable issue entity URLs", () => {
    expect(issueEntityUrl({ id: "iss_1", identifier: "PAP-1" } as Issue)).toBe("/issues/PAP-1");
    expect(issueEntityUrl({ id: "iss_2", identifier: null } as Issue)).toBe("/issues/iss_2");
  });

  it("builds provenance for comments", () => {
    const issue = { id: "iss_1", companyId: "co_1", identifier: "PAP-1" } as Issue;
    const comment = {
      id: "c_1",
      companyId: "co_1",
      issueId: "iss_1",
      authorAgentId: null,
      authorUserId: "user_1",
      body: "Hello",
      createdAt: new Date("2026-03-15T12:01:00.000Z"),
      updatedAt: new Date("2026-03-15T12:01:00.000Z"),
    } as IssueComment;

    const actor = actorFromComment(comment);
    const provenance = buildCommentProvenance(issue, comment, actor);

    expect(actor).toEqual({ authorType: "user", authorId: "user_1" });
    expect(provenance).toMatchObject({
      sourceSystem: "paperclip",
      companyId: "co_1",
      issueId: "iss_1",
      commentId: "c_1",
      authorType: "user",
      authorId: "user_1",
      paperclipEntityUrl: "/issues/PAP-1",
      contentType: "issue_comment",
    });
  });

  it("builds provenance for document revisions and sections documents safely", () => {
    const issue = { id: "iss_1", companyId: "co_1", identifier: "PAP-1" } as Issue;
    const revision = {
      id: "rev_2",
      companyId: "co_1",
      documentId: "doc_1",
      issueId: "iss_1",
      key: "design",
      revisionNumber: 2,
      body: "# Design\n\nStable chunk one.\n\nStable chunk two.",
      changeSummary: "Update",
      createdByAgentId: "agent_1",
      createdByUserId: null,
      createdAt: new Date("2026-03-15T12:03:00.000Z"),
    } as DocumentRevision;

    const actor = actorFromDocumentRevision(revision);
    const provenance = buildDocumentProvenance(issue, revision, actor);
    const sections = splitDocumentIntoSections(
      { key: "design", title: "Design Notes" },
      revision,
      24,
      4,
    );

    expect(actor).toEqual({ authorType: "agent", authorId: "agent_1" });
    expect(provenance).toMatchObject({
      sourceSystem: "paperclip",
      companyId: "co_1",
      issueId: "iss_1",
      documentRevisionId: "rev_2",
      authorType: "agent",
      authorId: "agent_1",
      contentType: "issue_document_section",
    });
    expect(sections.length).toBeGreaterThan(1);
    expect(sections[0]?.key).toBe("design:r2:s0");
    expect(sections.every((section) => section.content.trim().length > 0)).toBe(true);
  });
});
