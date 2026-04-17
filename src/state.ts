import type { PluginContext } from "@paperclipai/plugin-sdk";
import {
  COMPANY_CHECKPOINT_STATE_KEY,
  COMPANY_STATUS_STATE_KEY,
  INSTANCE_JOB_TARGETS_STATE_KEY,
  ISSUE_STATUS_STATE_KEY,
  STATE_NAMESPACE,
} from "./constants.js";
import type {
  CompanyMemoryCheckpoint,
  CompanyMemoryStatus,
  IssueSyncStatus,
  SyncErrorSummary,
} from "./types.js";

const EMPTY_ISSUE_STATUS: IssueSyncStatus = {
  lastSyncedCommentId: null,
  lastSyncedCommentCreatedAt: null,
  lastSyncedDocumentRevisionKey: null,
  lastSyncedDocumentRevisionId: null,
  lastSyncedRunId: null,
  lastSyncedRunFinishedAt: null,
  lastBackfillAt: null,
  replayRequestedAt: null,
  replayInProgress: false,
  lastError: null,
  latestContextPreview: null,
  latestContextFetchedAt: null,
  latestAppendAt: null,
  latestPromptContextPreview: null,
  latestPromptContextBuiltAt: null,
  latestHierarchyContextPreview: null,
};

const EMPTY_COMPANY_STATUS: CompanyMemoryStatus = {
  connectionStatus: "not_configured",
  workspaceStatus: "unknown",
  peerStatus: "not_started",
  initializationStatus: "not_started",
  migrationStatus: "not_started",
  promptContextStatus: "inactive",
  lastSuccessfulSyncAt: null,
  lastError: null,
  pendingFailureCount: 0,
  lastInitializationReport: null,
  latestMigrationPreview: null,
};

const EMPTY_COMPANY_CHECKPOINT: CompanyMemoryCheckpoint = {
  activeJobKey: null,
  status: "idle",
  processed: 0,
  succeeded: 0,
  skipped: 0,
  failed: 0,
  currentSourceType: null,
  currentEntityId: null,
  lastError: null,
  updatedAt: null,
};

type InstanceJobTargets = Record<string, string>;

function issueStateKey(issueId: string) {
  return {
    scopeKind: "issue" as const,
    scopeId: issueId,
    namespace: STATE_NAMESPACE,
    stateKey: ISSUE_STATUS_STATE_KEY,
  };
}

function companyStateKey(companyId: string) {
  return {
    scopeKind: "company" as const,
    scopeId: companyId,
    namespace: STATE_NAMESPACE,
    stateKey: COMPANY_STATUS_STATE_KEY,
  };
}

function companyCheckpointStateKey(companyId: string) {
  return {
    scopeKind: "company" as const,
    scopeId: companyId,
    namespace: STATE_NAMESPACE,
    stateKey: COMPANY_CHECKPOINT_STATE_KEY,
  };
}

function instanceJobTargetsStateKey() {
  return {
    scopeKind: "instance" as const,
    namespace: STATE_NAMESPACE,
    stateKey: INSTANCE_JOB_TARGETS_STATE_KEY,
  };
}

export async function getIssueSyncStatus(ctx: PluginContext, issueId: string): Promise<IssueSyncStatus> {
  const value = await ctx.state.get(issueStateKey(issueId));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_ISSUE_STATUS };
  }
  return { ...EMPTY_ISSUE_STATUS, ...(value as IssueSyncStatus) };
}

export async function setIssueSyncStatus(ctx: PluginContext, issueId: string, status: IssueSyncStatus): Promise<void> {
  await ctx.state.set(issueStateKey(issueId), status);
}

export async function patchIssueSyncStatus(
  ctx: PluginContext,
  issueId: string,
  patch: Partial<IssueSyncStatus>,
): Promise<IssueSyncStatus> {
  const next = { ...(await getIssueSyncStatus(ctx, issueId)), ...patch };
  await setIssueSyncStatus(ctx, issueId, next);
  return next;
}

export async function clearIssueSyncStatus(ctx: PluginContext, issueId: string): Promise<void> {
  await ctx.state.delete(issueStateKey(issueId));
}

export async function getCompanySyncStatus(ctx: PluginContext, companyId: string): Promise<CompanyMemoryStatus> {
  const value = await ctx.state.get(companyStateKey(companyId));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_COMPANY_STATUS };
  }
  return { ...EMPTY_COMPANY_STATUS, ...(value as CompanyMemoryStatus) };
}

export async function patchCompanySyncStatus(
  ctx: PluginContext,
  companyId: string,
  patch: Partial<CompanyMemoryStatus>,
): Promise<CompanyMemoryStatus> {
  const next = { ...(await getCompanySyncStatus(ctx, companyId)), ...patch };
  await ctx.state.set(companyStateKey(companyId), next);
  return next;
}

export async function getCompanyCheckpoint(ctx: PluginContext, companyId: string): Promise<CompanyMemoryCheckpoint> {
  const value = await ctx.state.get(companyCheckpointStateKey(companyId));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_COMPANY_CHECKPOINT };
  }
  return { ...EMPTY_COMPANY_CHECKPOINT, ...(value as CompanyMemoryCheckpoint) };
}

export async function patchCompanyCheckpoint(
  ctx: PluginContext,
  companyId: string,
  patch: Partial<CompanyMemoryCheckpoint>,
): Promise<CompanyMemoryCheckpoint> {
  const next = { ...(await getCompanyCheckpoint(ctx, companyId)), ...patch };
  await ctx.state.set(companyCheckpointStateKey(companyId), next);
  return next;
}

async function getInstanceJobTargets(ctx: PluginContext): Promise<InstanceJobTargets> {
  const value = await ctx.state.get(instanceJobTargetsStateKey());
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...(value as InstanceJobTargets) };
}

export async function setPreparedJobCompany(ctx: PluginContext, jobKey: string, companyId: string): Promise<void> {
  const next = {
    ...(await getInstanceJobTargets(ctx)),
    [jobKey]: companyId,
  };
  await ctx.state.set(instanceJobTargetsStateKey(), next);
}

export async function consumePreparedJobCompany(ctx: PluginContext, jobKey: string): Promise<string | null> {
  const targets = await getInstanceJobTargets(ctx);
  const companyId = typeof targets[jobKey] === "string" && targets[jobKey].trim().length > 0
    ? targets[jobKey]
    : null;
  if (!companyId) {
    return null;
  }
  const next = { ...targets };
  delete next[jobKey];
  if (Object.keys(next).length === 0) {
    await ctx.state.delete(instanceJobTargetsStateKey());
  } else {
    await ctx.state.set(instanceJobTargetsStateKey(), next);
  }
  return companyId;
}

export function buildSyncErrorSummary(input: {
  message: string;
  code?: string | null;
  issueId?: string | null;
  commentId?: string | null;
  documentKey?: string | null;
}): SyncErrorSummary {
  return {
    at: new Date().toISOString(),
    message: input.message,
    code: input.code ?? null,
    issueId: input.issueId ?? null,
    commentId: input.commentId ?? null,
    documentKey: input.documentKey ?? null,
  };
}
