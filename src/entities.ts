import type { Agent, Company, Issue, PluginContext } from "@paperclipai/plugin-sdk";
import { ENTITY_TYPES } from "./constants.js";
import {
  bootstrapSessionIdForAgent,
  bootstrapSessionIdForCompany,
  childSessionIdForRun,
  ownerPeerIdForCompany,
  peerIdForAgent,
  peerIdForUser,
  sessionIdForIssue,
  systemPeerId,
  workspaceIdForCompany,
} from "./ids.js";
import type { HonchoActor, LineageRecord, MigrationPreview } from "./types.js";

type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

async function upsertEntity(
  ctx: PluginContext,
  input: {
    entityType: EntityType;
    scopeKind: "company" | "issue";
    scopeId: string;
    externalId: string;
    title?: string | null;
    status?: string | null;
    data: Record<string, unknown>;
  },
) {
  return await ctx.entities.upsert({
    entityType: input.entityType,
    scopeKind: input.scopeKind,
    scopeId: input.scopeId,
    externalId: input.externalId,
    title: input.title ?? undefined,
    status: input.status ?? undefined,
    data: input.data,
  });
}

export async function upsertWorkspaceMapping(
  ctx: PluginContext,
  company: Company | null,
  companyId: string,
  workspacePrefix: string,
  status: "created" | "existing" | "mapped" = "mapped",
  workspaceId?: string,
) {
  const existing = await getWorkspaceMappingRecord(ctx, companyId);
  const mappedWorkspaceId = typeof existing?.data.workspaceId === "string" && existing.data.workspaceId.trim()
    ? existing.data.workspaceId
    : null;
  const mappedWorkspacePrefix = typeof existing?.data.workspacePrefix === "string" && existing.data.workspacePrefix.trim()
    ? existing.data.workspacePrefix
    : null;
  const canonicalWorkspaceId = mappedWorkspaceId ?? workspaceId ?? workspaceIdForCompany(companyId, workspacePrefix);
  const canonicalWorkspacePrefix = mappedWorkspacePrefix ?? workspacePrefix;
  return await upsertEntity(ctx, {
    entityType: ENTITY_TYPES.workspaceMapping,
    scopeKind: "company",
    scopeId: companyId,
    externalId: `paperclip:company:${companyId}`,
    title: company?.name ?? canonicalWorkspaceId,
    status,
    data: {
      companyId,
      companyName: company?.name ?? null,
      workspaceId: canonicalWorkspaceId,
      workspacePrefix: canonicalWorkspacePrefix,
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function upsertSessionMapping(
  ctx: PluginContext,
  issue: Issue,
  workspaceId: string,
) {
  return await upsertEntity(ctx, {
    entityType: ENTITY_TYPES.sessionMapping,
    scopeKind: "issue",
    scopeId: issue.id,
    externalId: `paperclip:issue:${issue.id}`,
    title: issue.identifier ?? issue.title,
    status: "mapped",
    data: {
      companyId: issue.companyId,
      issueId: issue.id,
      issueIdentifier: issue.identifier ?? null,
      sessionId: sessionIdForIssue(issue.id),
      workspaceId,
      issueTitle: issue.title,
      issueStatus: issue.status,
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function upsertBootstrapSessionMapping(
  ctx: PluginContext,
  companyId: string,
  input: {
    kind: "company" | "agent" | "run";
    agentId?: string;
    runId?: string;
    title: string;
    workspaceId: string;
  },
) {
  const sessionId = input.kind === "company"
    ? bootstrapSessionIdForCompany(companyId)
    : input.kind === "agent" && input.agentId
      ? bootstrapSessionIdForAgent(input.agentId)
      : childSessionIdForRun(input.runId ?? "unknown");
  const externalId = input.kind === "company"
    ? `paperclip:bootstrap:company:${companyId}`
    : input.kind === "agent" && input.agentId
      ? `paperclip:bootstrap:agent:${input.agentId}`
      : `paperclip:run:${input.runId}`;
  return await upsertEntity(ctx, {
    entityType: ENTITY_TYPES.sessionMapping,
    scopeKind: "company",
    scopeId: companyId,
    externalId,
    title: input.title,
    status: "mapped",
    data: {
      companyId,
      sessionId,
      workspaceId: input.workspaceId,
      title: input.title,
      kind: input.kind,
      agentId: input.agentId ?? null,
      runId: input.runId ?? null,
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function upsertAgentPeerMapping(
  ctx: PluginContext,
  companyId: string,
  agent: Agent,
  status: "mapped" | "missing" = "mapped",
) {
  const peerId = peerIdForAgent(agent.id);
  return await upsertEntity(ctx, {
    entityType: ENTITY_TYPES.peerMapping,
    scopeKind: "company",
    scopeId: companyId,
    externalId: `paperclip:agent:${agent.id}`,
    title: agent.name,
    status,
    data: {
      companyId,
      agentId: agent.id,
      peerId,
      peerType: "agent",
      name: agent.name,
      role: agent.role,
      title: agent.title,
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function upsertUserPeerMapping(
  ctx: PluginContext,
  companyId: string,
  userId: string,
  status: "mapped" | "missing" = "mapped",
) {
  const peerId = peerIdForUser(userId);
  return await upsertEntity(ctx, {
    entityType: ENTITY_TYPES.peerMapping,
    scopeKind: "company",
    scopeId: companyId,
    externalId: `paperclip:user:${userId}`,
    title: userId,
    status,
    data: {
      companyId,
      userId,
      peerId,
      peerType: "user",
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function upsertOwnerPeerMapping(
  ctx: PluginContext,
  companyId: string,
  status: "mapped" | "missing" = "mapped",
) {
  return await upsertEntity(ctx, {
    entityType: ENTITY_TYPES.peerMapping,
    scopeKind: "company",
    scopeId: companyId,
    externalId: `paperclip:owner:${companyId}`,
    title: "Company Owner",
    status,
    data: {
      companyId,
      peerId: ownerPeerIdForCompany(companyId),
      peerType: "owner",
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function upsertSystemPeerMapping(
  ctx: PluginContext,
  companyId: string,
  status: "mapped" | "missing" = "mapped",
) {
  return await upsertEntity(ctx, {
    entityType: ENTITY_TYPES.peerMapping,
    scopeKind: "company",
    scopeId: companyId,
    externalId: `paperclip:system:${companyId}`,
    title: "Paperclip System",
    status,
    data: {
      companyId,
      peerId: systemPeerId(),
      peerType: "system",
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function ensureActorPeerMapping(
  ctx: PluginContext,
  companyId: string,
  actor: HonchoActor,
) {
  if (actor.authorType === "agent") {
    const agent = await ctx.agents.get(actor.authorId, companyId);
    if (agent) {
      await upsertAgentPeerMapping(ctx, companyId, agent);
      return;
    }
  }
  if (actor.authorType === "user") {
    await upsertUserPeerMapping(ctx, companyId, actor.authorId);
  }
}

export async function upsertImportLedger(
  ctx: PluginContext,
  companyId: string,
  input: {
    sourceType: "issue_comment" | "issue_document" | "run_transcript" | "legacy_memory_file" | "workspace_guidance_file" | "agent_profile_file";
    externalId: string;
    fingerprint: string;
    issueId: string;
    issueIdentifier: string | null;
    importedAt: string;
    metadata: Record<string, unknown>;
  },
) {
  return await upsertEntity(ctx, {
    entityType: ENTITY_TYPES.importLedger,
    scopeKind: "company",
    scopeId: companyId,
    externalId: input.externalId,
    title: input.issueIdentifier ?? input.issueId,
    status: "imported",
    data: {
      ...input,
      lastSeenAt: input.importedAt,
    },
  });
}

export async function upsertAgentLineage(
  ctx: PluginContext,
  companyId: string,
  record: LineageRecord,
) {
  return await upsertEntity(ctx, {
    entityType: ENTITY_TYPES.agentLineage,
    scopeKind: "company",
    scopeId: companyId,
    externalId: `paperclip:run-lineage:${record.parentRunId}:${record.childRunId}`,
    title: `${record.parentAgentId} -> ${record.childAgentId}`,
    status: "mapped",
    data: {
      ...record,
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function getImportLedgerRecord(ctx: PluginContext, companyId: string, externalId: string) {
  const records = await ctx.entities.list({
    entityType: ENTITY_TYPES.importLedger,
    scopeKind: "company",
    scopeId: companyId,
    externalId,
    limit: 1,
  });
  return records[0] ?? null;
}

export async function getWorkspaceMappingRecord(ctx: PluginContext, companyId: string) {
  const records = await ctx.entities.list({
    entityType: ENTITY_TYPES.workspaceMapping,
    scopeKind: "company",
    scopeId: companyId,
    externalId: `paperclip:company:${companyId}`,
    limit: 1,
  });
  return records[0] ?? null;
}

export async function resolveCanonicalWorkspaceId(
  ctx: PluginContext,
  companyId: string,
  workspacePrefix: string,
) {
  const mapping = await getWorkspaceMappingRecord(ctx, companyId);
  const mappedWorkspaceId = typeof mapping?.data.workspaceId === "string" && mapping.data.workspaceId.trim()
    ? mapping.data.workspaceId
    : null;
  return mappedWorkspaceId ?? workspaceIdForCompany(companyId, workspacePrefix);
}

export async function upsertMigrationReport(
  ctx: PluginContext,
  companyId: string,
  reportType: "preview" | "initialization" | "import",
  payload: Record<string, unknown>,
) {
  return await upsertEntity(ctx, {
    entityType: ENTITY_TYPES.migrationReport,
    scopeKind: "company",
    scopeId: companyId,
    externalId: `paperclip:${reportType}:${companyId}`,
    title: `${reportType}:${companyId}`,
    status: "ready",
    data: payload,
  });
}

export async function upsertFileImportSource(
  ctx: PluginContext,
  companyId: string,
  input: {
    workspaceId: string;
    projectId: string;
    relativePath: string;
    sourceCategory: string;
  },
) {
  return await upsertEntity(ctx, {
    entityType: ENTITY_TYPES.fileImportSource,
    scopeKind: "company",
    scopeId: companyId,
    externalId: `${input.workspaceId}:${input.relativePath}`,
    title: input.relativePath,
    status: "ready",
    data: {
      companyId,
      ...input,
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function listMappingCounts(ctx: PluginContext, companyId: string) {
  const [peers, sessions, ledger] = await Promise.all([
    ctx.entities.list({
      entityType: ENTITY_TYPES.peerMapping,
      scopeKind: "company",
      scopeId: companyId,
      limit: 500,
    }),
    ctx.entities.list({
      entityType: ENTITY_TYPES.sessionMapping,
      scopeKind: "issue",
      limit: 500,
    }),
    ctx.entities.list({
      entityType: ENTITY_TYPES.importLedger,
      scopeKind: "company",
      scopeId: companyId,
      limit: 1000,
    }),
  ]);

  return {
    mappedPeers: peers.length,
    mappedSessions: sessions.filter((record) => record.data.companyId === companyId).length,
    importedComments: ledger.filter((record) => record.data.sourceType === "issue_comment").length,
    importedDocuments: ledger.filter((record) => record.data.sourceType === "issue_document").length,
    importedRuns: ledger.filter((record) => record.data.sourceType === "run_transcript").length,
    importedFiles: ledger.filter((record) => String(record.data.sourceType).includes("file")).length,
  };
}

export async function listJobsForUi(ctx: PluginContext) {
  return (ctx.manifest.jobs ?? []).map((job) => ({
    id: job.jobKey,
    jobKey: job.jobKey,
    displayName: job.displayName,
    status: "ready",
  }));
}

export function buildWorkspaceId(companyId: string, workspacePrefix: string) {
  return workspaceIdForCompany(companyId, workspacePrefix);
}

export function buildMigrationReportPayload(companyId: string, preview: MigrationPreview) {
  return {
    companyId,
    preview,
    generatedAt: preview.generatedAt,
  };
}
