import type { Issue } from "@paperclipai/plugin-sdk";
import { createHash } from "node:crypto";

function toHonchoSafeSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function joinHonchoId(parts: string[]): string {
  return parts
    .map((part) => toHonchoSafeSegment(part))
    .filter((part) => part.length > 0)
    .join("_");
}

export function workspaceIdForCompany(companyId: string, workspacePrefix: string): string {
  return joinHonchoId([workspacePrefix, companyId]);
}

export function peerIdForAgent(agentId: string, agentUrlKey?: string | null): string {
  if (typeof agentUrlKey === "string") {
    const safeUrlKey = toHonchoSafeSegment(agentUrlKey);
    if (safeUrlKey) {
      return joinHonchoId(["agent", safeUrlKey]);
    }
  }
  return joinHonchoId(["agent", agentId]);
}

export function peerIdForUser(userId: string): string {
  return joinHonchoId(["user", userId]);
}

export function sessionIdForIssue(issueId: string, issueIdentifier?: string | null): string {
  if (typeof issueIdentifier === "string" && issueIdentifier.trim()) {
    return joinHonchoId([issueIdentifier]);
  }
  return joinHonchoId(["issue", issueId]);
}

export function ownerPeerIdForCompany(companyId: string): string {
  return joinHonchoId(["owner", "company", companyId]);
}

export function systemPeerId(): string {
  return joinHonchoId(["system", "paperclip"]);
}

export function bootstrapSessionIdForCompany(companyId: string): string {
  return joinHonchoId(["bootstrap", "company", companyId]);
}

export function bootstrapSessionIdForAgent(agentId: string): string {
  return joinHonchoId(["bootstrap", "agent", agentId]);
}

export function childSessionIdForRun(runId: string): string {
  return joinHonchoId(["run", runId]);
}

export function hashId(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

export function fileExternalId(workspaceId: string, relativePath: string): string {
  return `paperclip:file:${workspaceId}:${hashId(relativePath)}`;
}

export function fileRevisionExternalId(workspaceId: string, relativePath: string, content: string): string {
  return `${fileExternalId(workspaceId, relativePath)}:rev:${hashId(content)}`;
}

export function issueEntityUrl(issue: Pick<Issue, "id" | "identifier">): string {
  return `/issues/${issue.identifier ?? issue.id}`;
}
