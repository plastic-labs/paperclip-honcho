import type { Issue, IssueComment } from "@paperclipai/plugin-sdk";
import type { DocumentRevision, HonchoActor, HonchoProvenance, IssueDocumentRef } from "./types.js";
import { issueEntityUrl } from "./ids.js";

export function actorFromComment(comment: IssueComment): HonchoActor {
  if (comment.authorAgentId) {
    return { authorType: "agent", authorId: comment.authorAgentId };
  }
  if (comment.authorUserId) {
    return { authorType: "user", authorId: comment.authorUserId };
  }
  return { authorType: "system", authorId: "paperclip" };
}

export function actorFromDocumentRevision(revision: DocumentRevision): HonchoActor {
  if (revision.createdByAgentId) {
    return { authorType: "agent", authorId: revision.createdByAgentId };
  }
  if (revision.createdByUserId) {
    return { authorType: "user", authorId: revision.createdByUserId };
  }
  return { authorType: "system", authorId: "paperclip" };
}

export function buildCommentProvenance(
  issue: Pick<Issue, "id" | "identifier" | "companyId">,
  comment: IssueComment,
  actor: HonchoActor,
): HonchoProvenance {
  return {
    sourceSystem: "paperclip",
    companyId: issue.companyId,
    issueId: issue.id,
    runId: null,
    commentId: comment.id,
    documentRevisionId: null,
    authorType: actor.authorType,
    authorId: actor.authorId,
    paperclipEntityUrl: issueEntityUrl(issue),
    paperclipIssueIdentifier: issue.identifier ?? null,
    ingestedAt: new Date().toISOString(),
    contentType: "issue_comment",
  };
}

export function buildDocumentProvenance(
  issue: Pick<Issue, "id" | "identifier" | "companyId">,
  revision: DocumentRevision,
  actor: HonchoActor,
): HonchoProvenance {
  return {
    sourceSystem: "paperclip",
    companyId: issue.companyId,
    issueId: issue.id,
    runId: null,
    commentId: null,
    documentRevisionId: revision.id,
    authorType: actor.authorType,
    authorId: actor.authorId,
    paperclipEntityUrl: issueEntityUrl(issue),
    paperclipIssueIdentifier: issue.identifier ?? null,
    ingestedAt: new Date().toISOString(),
    contentType: "issue_document_section",
  };
}

export function buildRunProvenance(
  issue: Pick<Issue, "id" | "identifier" | "companyId">,
  input: {
    runId: string;
    authorType: HonchoActor["authorType"];
    authorId: string;
  },
): HonchoProvenance {
  return {
    sourceSystem: "paperclip",
    companyId: issue.companyId,
    issueId: issue.id,
    runId: input.runId,
    commentId: null,
    documentRevisionId: null,
    authorType: input.authorType,
    authorId: input.authorId,
    paperclipEntityUrl: issueEntityUrl(issue),
    paperclipIssueIdentifier: issue.identifier ?? null,
    ingestedAt: new Date().toISOString(),
    contentType: "run_transcript_chunk",
  };
}

export function buildFileProvenance(input: {
  companyId: string;
  workspaceId: string;
  projectId: string;
  relativePath: string;
  authorType: HonchoActor["authorType"];
  authorId: string;
  contentType: HonchoProvenance["contentType"];
  sourceCategory: string;
  importMode: "bootstrap" | "migration" | "resync";
}) {
  return {
    sourceSystem: "paperclip" as const,
    companyId: input.companyId,
    issueId: `workspace:${input.workspaceId}`,
    runId: null,
    commentId: null,
    documentRevisionId: null,
    authorType: input.authorType,
    authorId: input.authorId,
    paperclipEntityUrl: `/projects/${input.projectId}`,
    paperclipIssueIdentifier: null,
    ingestedAt: new Date().toISOString(),
    contentType: input.contentType,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    relativePath: input.relativePath,
    sourceCategory: input.sourceCategory,
    importMode: input.importMode,
  };
}

export function splitDocumentIntoSections(document: IssueDocumentRef, revision: DocumentRevision, sectionSize: number, overlap: number) {
  const body = revision.body;
  if (!body.trim()) return [];
  const sections: Array<{ key: string; index: number; content: string }> = [];
  let start = 0;
  let index = 0;
  const safeOverlap = Math.max(0, Math.min(overlap, Math.floor(sectionSize / 2)));
  while (start < body.length) {
    const end = Math.min(body.length, start + sectionSize);
    const content = body.slice(start, end).trim();
    if (content) {
      sections.push({
        key: `${document.key}:r${revision.revisionNumber}:s${index}`,
        index,
        content,
      });
    }
    if (end >= body.length) break;
    start = Math.max(end - safeOverlap, start + 1);
    index += 1;
  }
  return sections;
}
