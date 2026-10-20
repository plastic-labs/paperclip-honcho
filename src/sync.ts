import {
  PLUGIN_RPC_ERROR_CODES,
  type Agent,
  type Company,
  type Issue,
  type IssueComment,
  type PluginContext,
} from "@paperclipai/plugin-sdk";
import {
  DEFAULT_BACKFILL_BATCH_SIZE,
  DEFAULT_DOCUMENT_SECTION_OVERLAP,
  DEFAULT_DOCUMENT_SECTION_SIZE,
  DEFAULT_MAX_INGEST_MESSAGE_CHARS,
  DEFAULT_MIN_IMPORT_TEXT_LENGTH,
  DEFAULT_NOISE_PATTERNS,
  DEFAULT_SEARCH_LIMIT,
} from "./constants.js";
import { getResolvedConfig, validateConfig } from "./config.js";
import {
  bootstrapSessionIdForAgent,
  bootstrapSessionIdForCompany,
  fileExternalId,
  ownerPeerIdForCompany,
  peerIdForAgent,
  peerIdForUser,
  systemPeerId,
} from "./ids.js";
import {
  actorFromComment,
  actorFromDocumentRevision,
  buildCommentProvenance,
  buildDocumentProvenance,
  splitDocumentIntoSections,
} from "./provenance.js";
import {
  buildSyncErrorSummary,
  getCompanyCheckpoint,
  clearIssueSyncStatus,
  getCompanySyncStatus,
  getIssueSyncStatus,
  patchCompanyCheckpoint,
  patchCompanySyncStatus,
  patchIssueSyncStatus,
} from "./state.js";
import { createHonchoClient } from "./honcho-client.js";
import { syncAgentRuntimeMcpBridge, type McpBridgeSyncResult } from "./mcp-bridge.js";
import {
  buildMigrationReportPayload,
  ensureActorPeerMapping,
  getAgentPeerMappingRecord,
  getImportLedgerRecord,
  getSessionMappingRecord,
  listJobsForUi,
  listMappingCounts,
  resolveCanonicalAgentPeerId,
  resolveCanonicalIssueSessionId,
  upsertAgentPeerMapping,
  upsertBootstrapSessionMapping,
  upsertFileImportSource,
  upsertOwnerPeerMapping,
  upsertImportLedger,
  upsertMigrationReport,
  upsertSessionMapping,
  upsertSystemPeerMapping,
  upsertUserPeerMapping,
  upsertWorkspaceMapping,
} from "./entities.js";
import type {
  DocumentRevision,
  HonchoActor,
  HonchoIssueContext,
  HonchoSearchResult,
  NormalizedMessage,
  HonchoMessageInput,
  HonchoResolvedConfig,
  IssueDocumentBundle,
  IssueSyncStatus,
  InitializationReport,
  MemoryStatusData,
  MigrationJobStatusData,
  MigrationPreview,
  MigrationSourceCandidate,
  PromptContextBuildResult,
  RepairMappingsResult,
  PromptContextBuildInput,
  SearchMemoryParams,
  SyncIssueOptions,
  SyncIssueResult,
  SyncableIssueResource,
} from "./types.js";

type MigrationCandidatesLoader = (
  ctx: PluginContext,
  companyId: string,
) => Promise<MigrationSourceCandidate[]>;

let migrationCandidatesLoaderOverride: MigrationCandidatesLoader | null = null;
const issueSyncQueue = new Map<string, Promise<void>>();
// Companies with an initialization running in this worker. Import dedup reads
// each session's existing messages once per run, before appending, so two
// overlapping runs for one company would both append every message.
const initializingCompanies = new Set<string>();

function pastDeadline(deadline: number | undefined): boolean {
  return deadline !== undefined && Date.now() >= deadline;
}

// The host refuses a call's company-scoped requests once it has given up on
// the call, for example after the 30 s action timeout.
function isInvocationScopeDenied(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === PLUGIN_RPC_ERROR_CODES.INVOCATION_SCOPE_DENIED;
}

/**
 * What one initialization has done so far, kept in the worker between the
 * action calls (rounds) it takes. Host reads are most of a round's cost, so a
 * round reads nothing an earlier round already read and continues where that
 * round stopped. Without this every round re-lists and re-reads every issue
 * before it starts new work, and a large company never finishes.
 *
 * Losing it (worker restart, config change, idle too long) only costs time:
 * mappings, the import ledger and the issue cursors still let a fresh run skip
 * finished work.
 */
type InitializationRun = {
  configKey: string;
  idleTimer?: ReturnType<typeof setTimeout>;
  agents: Agent[] | null;
  issues: Issue[] | null;
  // agents[0..agentsChecked) and issues[0..issuesChecked) are mapped.
  agentsChecked: number;
  issuesChecked: number;
  // issues[0..issuesRead) have their import candidates in `collected`.
  issuesRead: number;
  collected: MigrationSourceCandidate[];
  // Candidates left to import, oldest first. Null until every issue is read.
  pending: MigrationSourceCandidate[] | null;
  imported: { processed: number; succeeded: number; skipped: number; failed: number; firstError: string | null };
};

const INITIALIZATION_RUN_IDLE_MS = 10 * 60 * 1_000;
const initializationRuns = new WeakMap<PluginContext, Map<string, InitializationRun>>();

function newInitializationRun(configKey: string): InitializationRun {
  return {
    configKey,
    agents: null,
    issues: null,
    agentsChecked: 0,
    issuesChecked: 0,
    issuesRead: 0,
    collected: [],
    pending: null,
    imported: { processed: 0, succeeded: 0, skipped: 0, failed: 0, firstError: null },
  };
}

function initializationRunFor(ctx: PluginContext, companyId: string, config: HonchoResolvedConfig): InitializationRun {
  let runs = initializationRuns.get(ctx);
  if (!runs) {
    runs = new Map();
    initializationRuns.set(ctx, runs);
  }
  const configKey = JSON.stringify(config);
  let run = runs.get(companyId);
  clearTimeout(run?.idleTimer);
  if (!run || run.configKey !== configKey) {
    run = newInitializationRun(configKey);
    runs.set(companyId, run);
  }
  // A run holds every issue and candidate it read. Drop it once no call has
  // used it for a while, for example after the settings page was closed.
  const current = run;
  const companyRuns = runs;
  run.idleTimer = setTimeout(() => {
    if (companyRuns.get(companyId) === current) companyRuns.delete(companyId);
  }, INITIALIZATION_RUN_IDLE_MS);
  run.idleTimer.unref?.();
  return run;
}

function dropInitializationRun(ctx: PluginContext, companyId: string): void {
  const runs = initializationRuns.get(ctx);
  clearTimeout(runs?.get(companyId)?.idleTimer);
  runs?.delete(companyId);
}

// Grows with every agent and issue checked, issue read and candidate imported,
// so the settings page can tell a round that moved on from one that did not.
function initializationProgress(run: InitializationRun): number {
  return run.agentsChecked + run.issuesChecked + run.issuesRead + run.imported.processed;
}

async function resolvePeerIdFromActor(
  ctx: PluginContext,
  companyId: string,
  actor: HonchoActor,
): Promise<string> {
  if (actor.authorType === "agent") {
    const agent = await ctx.agents.get(actor.authorId, companyId);
    return agent
      ? await resolveCanonicalAgentPeerId(ctx, companyId, agent)
      : peerIdForAgent(actor.authorId, null);
  }
  if (actor.authorType === "user") return peerIdForUser(actor.authorId);
  return systemPeerId();
}

function compareComments(left: IssueComment, right: IssueComment): number {
  return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
}

function compareRevisions(left: DocumentRevision, right: DocumentRevision): number {
  return left.revisionNumber - right.revisionNumber;
}

function toDocumentRevision(
  issueId: string,
  document: IssueDocumentBundle["document"],
): DocumentRevision {
  return {
    id: document.latestRevisionId ?? `${document.id}:latest`,
    documentId: document.id ?? `${issueId}:${document.key}`,
    issueId,
    key: document.key,
    revisionNumber: document.latestRevisionNumber ?? 1,
    body: document.body ?? "",
    createdByAgentId: document.updatedByAgentId ?? document.createdByAgentId ?? null,
    createdByUserId: document.updatedByUserId ?? document.createdByUserId ?? null,
    createdAt: document.updatedAt ?? new Date().toISOString(),
    changeSummary: null,
  };
}

async function listDocumentBundles(
  ctx: PluginContext,
  issueId: string,
  companyId: string,
): Promise<IssueDocumentBundle[]> {
  const summaries = await ctx.issues.documents.list(issueId, companyId);
  const documents = await Promise.all(
    summaries.map(async (summary) => await ctx.issues.documents.get(issueId, summary.key, companyId)),
  );
  return documents.flatMap((document) => {
    if (!document) return [];
    return [{
      document: {
        id: document.id,
        key: document.key,
        title: document.title ?? null,
        body: document.body,
        latestRevisionId: document.latestRevisionId ?? null,
        latestRevisionNumber: document.latestRevisionNumber ?? null,
        updatedAt: document.updatedAt,
        updatedByAgentId: document.updatedByAgentId ?? null,
        updatedByUserId: document.updatedByUserId ?? null,
        createdByAgentId: document.createdByAgentId ?? null,
        createdByUserId: document.createdByUserId ?? null,
      },
      revisions: [toDocumentRevision(issueId, {
        id: document.id,
        key: document.key,
        title: document.title ?? null,
        body: document.body,
        latestRevisionId: document.latestRevisionId ?? null,
        latestRevisionNumber: document.latestRevisionNumber ?? null,
        updatedAt: document.updatedAt,
        updatedByAgentId: document.updatedByAgentId ?? null,
        updatedByUserId: document.updatedByUserId ?? null,
        createdByAgentId: document.createdByAgentId ?? null,
        createdByUserId: document.createdByUserId ?? null,
      })],
    }];
  });
}

function cleanNormalizedLines(
  raw: string,
  config: HonchoResolvedConfig,
): NormalizedMessage | null {
  const noisePatterns = buildNoisePatterns(config);
  const seen = new Set<string>();
  const kept: string[] = [];

  for (const candidate of raw.replace(/\r\n/g, "\n").split("\n")) {
    let line = candidate.trim();
    if (!line) continue;
    if (config.stripPlatformMetadata) {
      line = line.replace(/^\[[^\]]+\]\s*/, "").trim();
      if (!line) continue;
    }
    const normalizedLine = normalizeText(line);
    if (!normalizedLine) continue;
    if (seen.has(normalizedLine)) continue;
    if (noisePatterns.some((pattern) => pattern.test(normalizedLine))) continue;
    seen.add(normalizedLine);
    kept.push(line);
  }

  if (kept.length === 0) return null;
  const content = kept.join("\n").trim();
  const boundedContent = content.length > DEFAULT_MAX_INGEST_MESSAGE_CHARS
    ? `${content.slice(0, Math.max(0, DEFAULT_MAX_INGEST_MESSAGE_CHARS - 1)).trimEnd()}…`
    : content;
  const normalized = normalizeText(boundedContent);
  if (!normalized || normalized.length < DEFAULT_MIN_IMPORT_TEXT_LENGTH) return null;

  const nonPrintable = normalized.replace(/[\x20-\x7E]/g, "");
  if (nonPrintable.length > Math.max(4, normalized.length * 0.15)) return null;
  if (noisePatterns.some((pattern) => pattern.test(normalized))) return null;

  return {
    content: boundedContent,
    fingerprint: buildFingerprint([normalized]),
  };
}

async function ensureActorPeer(
  ctx: PluginContext,
  companyId: string,
  actor: HonchoActor,
  client: Awaited<ReturnType<typeof createHonchoClient>>,
): Promise<void> {
  if (actor.authorType === "agent") {
    const agent = await ctx.agents.get(actor.authorId, companyId);
    if (agent) {
      await client.ensureAgentPeer(companyId, agent);
      await upsertAgentPeerMapping(ctx, companyId, agent);
      return;
    }
  }
  if (actor.authorType === "user") {
    await client.ensureUserPeer(companyId, actor.authorId);
    await upsertUserPeerMapping(ctx, companyId, actor.authorId);
    return;
  }
  await client.ensurePeer(companyId, systemPeerId(), {
    company_id: companyId,
    system_id: "paperclip",
  });
}

async function ensureIssueTopology(
  ctx: PluginContext,
  resources: SyncableIssueResource,
  client: Awaited<ReturnType<typeof createHonchoClient>>,
  config: HonchoResolvedConfig,
): Promise<void> {
  const workspaceId = await client.ensureCompanyWorkspace(resources.issue.companyId, resources.company);
  await upsertWorkspaceMapping(ctx, resources.company, resources.issue.companyId, config.workspacePrefix);
  await client.ensureIssueSession(resources.issue, resources.company);
  await upsertSessionMapping(ctx, resources.issue, workspaceId);

  const actorKeys = new Set<string>();
  const queueActor = (actor: HonchoActor | null | undefined) => {
    if (!actor) return;
    actorKeys.add(`${actor.authorType}:${actor.authorId}`);
  };

  if (resources.issue.assigneeAgentId) {
    queueActor({ authorType: "agent", authorId: resources.issue.assigneeAgentId });
  }
  if (resources.issue.assigneeUserId) {
    queueActor({ authorType: "user", authorId: resources.issue.assigneeUserId });
  }
  if (resources.issue.createdByAgentId) {
    queueActor({ authorType: "agent", authorId: resources.issue.createdByAgentId });
  }
  if (resources.issue.createdByUserId) {
    queueActor({ authorType: "user", authorId: resources.issue.createdByUserId });
  }
  for (const comment of resources.comments) {
    queueActor(actorFromComment(comment));
  }
  for (const bundle of resources.documents) {
    for (const revision of bundle.revisions) {
      queueActor(actorFromDocumentRevision(revision));
    }
  }
  for (const key of actorKeys) {
    const [authorType, authorId] = key.split(":");
    await ensureActorPeer(
      ctx,
      resources.issue.companyId,
      {
        authorType: authorType as HonchoActor["authorType"],
        authorId,
      },
      client,
    );
  }
}

async function fetchIssueResources(
  ctx: PluginContext,
  issueId: string,
  companyId: string,
  config: HonchoResolvedConfig,
): Promise<SyncableIssueResource> {
  const [issue, company] = await Promise.all([
    ctx.issues.get(issueId, companyId),
    ctx.companies.get(companyId),
  ]);
  if (!issue) {
    throw new Error("Issue not found");
  }

  const comments = (await ctx.issues.listComments(issueId, companyId)).sort(compareComments);
  const documents: IssueDocumentBundle[] = config.syncIssueDocuments
    ? await listDocumentBundles(ctx, issueId, companyId)
    : [];
  return { issue, company, comments, documents };
}

async function buildCommentMessages(
  ctx: PluginContext,
  issue: Issue,
  comments: IssueComment[],
  config: HonchoResolvedConfig,
  replay: boolean,
  lastSyncedCommentId: string | null,
): Promise<HonchoMessageInput[]> {
  const started = replay || !lastSyncedCommentId;
  const messages: HonchoMessageInput[] = [];
  let unlocked = started;
  for (const comment of comments) {
    if (!unlocked) {
      if (comment.id === lastSyncedCommentId) {
        unlocked = true;
      }
      continue;
    }
    const normalized = normalizeAndFilterMessage(comment.body, config);
    if (!normalized) continue;
    const actor = actorFromComment(comment);
    const peerId = await resolvePeerIdFromActor(ctx, issue.companyId, actor);
    messages.push({
      content: normalized.content,
      peerId,
      createdAt: new Date(comment.createdAt).toISOString(),
      metadata: {
        ...buildCommentProvenance(issue, comment, actor),
        issueTitle: issue.title,
        issueStatus: issue.status,
      },
    });
  }
  return messages;
}

// Back-compat shim for the per-document dedup cursor. Issues synced before
// syncedDocumentRevisions existed only have the legacy single-cursor fields
// (lastSyncedDocumentRevisionKey/Id). Seeding the map from them means a
// single-document issue (the common case) never re-emits its already-synced
// document on the first sync after upgrade. Multi-document issues re-emit any
// document the legacy cursor didn't cover exactly once, then settle into
// correct per-document dedup — strictly better than the old cursor, which
// re-emitted those documents on every sync.
function resolveSyncedDocumentRevisions(status: IssueSyncStatus): Record<string, string> {
  const stored = status.syncedDocumentRevisions;
  if (stored && Object.keys(stored).length > 0) return stored;
  if (status.lastSyncedDocumentRevisionKey && status.lastSyncedDocumentRevisionId) {
    return { [status.lastSyncedDocumentRevisionKey]: status.lastSyncedDocumentRevisionId };
  }
  return {};
}

async function buildDocumentMessages(
  ctx: PluginContext,
  issue: Issue,
  documents: IssueDocumentBundle[],
  config: HonchoResolvedConfig,
  replay: boolean,
  syncedDocumentRevisions: Record<string, string>,
): Promise<HonchoMessageInput[]> {
  const messages: HonchoMessageInput[] = [];

  for (const bundle of documents) {
    for (const revision of bundle.revisions) {
      // Per-document dedup: a document's revision is only (re)synced when its
      // revision id differs from what was last synced for that specific
      // document key. This is order-independent and handles multiple
      // independently-revised documents on one issue correctly — unlike a
      // single linear cursor, which re-synced trailing documents and dropped
      // edits to others whenever an issue had more than one document.
      if (!replay && syncedDocumentRevisions[bundle.document.key] === revision.id) {
        continue;
      }
      const actor = actorFromDocumentRevision(revision);
      const peerId = await resolvePeerIdFromActor(ctx, issue.companyId, actor);
      for (const section of splitDocumentIntoSections(
        bundle.document,
        revision,
        DEFAULT_DOCUMENT_SECTION_SIZE,
        DEFAULT_DOCUMENT_SECTION_OVERLAP,
      )) {
        const normalized = normalizeAndFilterMessage(section.content, config);
        if (!normalized) continue;
        messages.push({
          content: normalized.content,
          peerId,
          createdAt: new Date(revision.createdAt).toISOString(),
          metadata: {
            ...buildDocumentProvenance(issue, revision, actor),
            documentKey: bundle.document.key,
            documentTitle: bundle.document.title,
            revisionNumber: revision.revisionNumber,
            sectionKey: section.key,
            sectionIndex: section.index,
          },
        });
      }
    }
  }

  return messages;
}

function formatSearchResults(results: Awaited<ReturnType<typeof searchMemory>>): string | null {
  const lines = results
    .map((result, index) => {
      const content = typeof result.content === "string" ? result.content.trim() : "";
      if (!content) return null;
      return `${index + 1}. ${content}`;
    })
    .filter((value): value is string => Boolean(value));
  return lines.length > 0 ? lines.join("\n") : null;
}

async function refreshContextPreview(
  ctx: PluginContext,
  issue: Issue,
  company: Company | null,
  config: HonchoResolvedConfig,
  client?: Awaited<ReturnType<typeof createHonchoClient>>,
): Promise<HonchoIssueContext> {
  const resolvedClient = client ?? await createHonchoClient({ ctx, config });
  await resolvedClient.ensureCompanyWorkspace(issue.companyId, company);
  await resolvedClient.ensureIssueSession(issue, company);
  const targetUserId = issue.assigneeUserId ?? issue.createdByUserId ?? null;
  const context = await resolvedClient.getIssueContext(
    issue.companyId,
    issue.id,
    targetUserId ? peerIdForUser(targetUserId) : null,
  );
  await patchIssueSyncStatus(ctx, issue.id, {
    latestContextPreview: context.preview,
    latestContextFetchedAt: new Date().toISOString(),
    lastError: null,
  });
  return {
    ...context,
    issueIdentifier: issue.identifier ?? null,
  };
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function buildFingerprint(parts: string[]): string {
  return parts.map((part) => normalizeText(part)).join("|");
}

function buildNoisePatterns(config: HonchoResolvedConfig): RegExp[] {
  const patterns = [
    ...(config.disableDefaultNoisePatterns ? [] : DEFAULT_NOISE_PATTERNS),
    ...config.noisePatterns,
  ];
  return patterns.map((pattern) => {
    try {
      return new RegExp(pattern, "i");
    } catch {
      return /^$/;
    }
  });
}

function normalizeAndFilterMessage(
  raw: string,
  config: HonchoResolvedConfig,
): NormalizedMessage | null {
  return cleanNormalizedLines(raw, config);
}

// Read every page of a host list, not just the first.
async function listAllPages<T extends { id: string }>(
  listPage: (page: { limit: number; offset: number }) => Promise<T[]>,
): Promise<T[]> {
  const items: T[] = [];
  const seen = new Set<string>();
  let offset = 0;
  while (true) {
    const batch = await listPage({ limit: DEFAULT_BACKFILL_BATCH_SIZE, offset });
    if (batch.length === 0) break;
    // Dedup by id and stop once a batch adds nothing new. Some hosts clamp or
    // ignore `offset`, returning overlapping/repeated pages; without this guard
    // that both duplicates every downstream candidate (→ duplicate Honcho
    // messages) and can loop forever.
    let added = 0;
    for (const item of batch) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
      added += 1;
    }
    if (added === 0) break;
    offset += batch.length;
  }
  return items;
}

async function listCompanyIssues(ctx: PluginContext, companyId: string): Promise<Issue[]> {
  // Always read from offset 0 with a growing limit and keep the new tail.
  // Current hosts window issues.list twice (limit/offset in SQL, then the same
  // offset again on the returned rows), so any request with offset > 0 comes
  // back empty and paging stops after the first 100 issues. The limit doubles
  // so a large company takes a few calls rather than one per 100 issues.
  return await listAllPages(async ({ limit, offset }) =>
    (await ctx.issues.list({ companyId, limit: Math.max(limit, offset * 2), offset: 0 })).slice(offset));
}

async function listCompanyAgents(ctx: PluginContext, companyId: string): Promise<Agent[]> {
  return await listAllPages((page) => ctx.agents.list({ companyId, ...page }));
}

function sortCandidatesByTime(candidates: MigrationSourceCandidate[]): MigrationSourceCandidate[] {
  return candidates.sort((left, right) => {
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
}

async function buildMigrationCandidates(
  ctx: PluginContext,
  companyId: string,
): Promise<MigrationSourceCandidate[]> {
  const config = await getResolvedConfig(ctx, companyId);
  const issues = await listCompanyIssues(ctx, companyId);
  const candidates: MigrationSourceCandidate[] = [];
  for (const issue of issues) {
    candidates.push(...await buildIssueMigrationCandidates(ctx, companyId, config, issue));
  }
  return sortCandidatesByTime(candidates);
}

async function buildIssueMigrationCandidates(
  ctx: PluginContext,
  companyId: string,
  config: HonchoResolvedConfig,
  issue: Issue,
): Promise<MigrationSourceCandidate[]> {
  const candidates: MigrationSourceCandidate[] = [];
  const comments = (await ctx.issues.listComments(issue.id, companyId)).sort(compareComments);
  for (const comment of comments) {
    const normalized = normalizeAndFilterMessage(comment.body, config);
    if (!normalized) continue;
    const actor = actorFromComment(comment);
    candidates.push({
      sourceType: "issue_comments",
      issueId: issue.id,
      issueIdentifier: issue.identifier ?? null,
      sourceId: comment.id,
      fingerprint: buildFingerprint(["comment", comment.id, normalized.fingerprint]),
      authorType: actor.authorType,
      authorId: actor.authorId,
      createdAt: new Date(comment.createdAt).toISOString(),
      content: normalized.content,
      title: issue.identifier ?? issue.id,
      metadata: {
        ...buildCommentProvenance(issue, comment, actor),
        issueTitle: issue.title,
        issueStatus: issue.status,
      },
    });
  }
  if (config.syncIssueDocuments) {
    const documents = await listDocumentBundles(ctx, issue.id, companyId);
    for (const bundle of documents) {
      for (const revision of bundle.revisions) {
        const actor = actorFromDocumentRevision(revision);
        for (const section of splitDocumentIntoSections(
          bundle.document,
          revision,
          DEFAULT_DOCUMENT_SECTION_SIZE,
          DEFAULT_DOCUMENT_SECTION_OVERLAP,
        )) {
          const normalized = normalizeAndFilterMessage(section.content, config);
          if (!normalized) continue;
          candidates.push({
            sourceType: "issue_documents",
            issueId: issue.id,
            issueIdentifier: issue.identifier ?? null,
            sourceId: `${revision.id}:${section.key}`,
            fingerprint: buildFingerprint(["document", revision.id, section.key, normalized.fingerprint]),
            authorType: actor.authorType,
            authorId: actor.authorId,
            createdAt: new Date(revision.createdAt).toISOString(),
            content: normalized.content,
            title: issue.identifier ?? issue.id,
            metadata: {
              ...buildDocumentProvenance(issue, revision, actor),
              issueTitle: issue.title,
              issueStatus: issue.status,
              documentKey: bundle.document.key,
              documentTitle: bundle.document.title,
              revisionNumber: revision.revisionNumber,
              sectionKey: section.key,
              sectionIndex: section.index,
            },
          });
        }
      }
    }
  }
  return candidates;
}

function dedupeMigrationCandidates(candidates: MigrationSourceCandidate[]): MigrationSourceCandidate[] {
  // Guarantee each source is imported at most once per run, independent of any
  // upstream duplication (e.g. a host that repeats issue-list pages). Keyed by
  // (sourceType, sourceId) — the same identity used for the import ledger.
  const seen = new Set<string>();
  const out: MigrationSourceCandidate[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.sourceType}:${candidate.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return out;
}

async function loadMigrationCandidates(
  ctx: PluginContext,
  companyId: string,
): Promise<MigrationSourceCandidate[]> {
  const candidates = migrationCandidatesLoaderOverride
    ? await migrationCandidatesLoaderOverride(ctx, companyId)
    : await buildMigrationCandidates(ctx, companyId);
  return await filterAlreadySyncedMigrationCandidates(ctx, dedupeMigrationCandidates(candidates));
}

// Reads the import candidates of the run's issues into run.pending, as many
// issues per round as the deadline allows. Returns false when the deadline
// passed before the last issue was read.
async function collectMigrationCandidates(
  ctx: PluginContext,
  companyId: string,
  config: HonchoResolvedConfig,
  run: InitializationRun,
  deadline: number | undefined,
): Promise<boolean> {
  if (migrationCandidatesLoaderOverride) {
    run.pending = await loadMigrationCandidates(ctx, companyId);
    return true;
  }
  const issues = run.issues ??= await listCompanyIssues(ctx, companyId);
  while (run.issuesRead < issues.length) {
    const issue = issues[run.issuesRead]!;
    // Filtering one issue's candidates in time order matches filtering them
    // within the full time-sorted list. The issue list may be from an earlier
    // call: skip an issue deleted or made private since, which the host
    // reports as not found.
    const issueCandidates = sortCandidatesByTime(
      await buildIssueMigrationCandidates(ctx, companyId, config, issue).catch(async (error) => {
        if (await ctx.issues.get(issue.id, companyId)) throw error;
        return [];
      }),
    );
    run.collected.push(...await filterAlreadySyncedMigrationCandidates(ctx, issueCandidates));
    run.issuesRead += 1;
    if (pastDeadline(deadline) && run.issuesRead < issues.length) return false;
  }
  run.pending = dedupeMigrationCandidates(sortCandidatesByTime(run.collected));
  run.collected = [];
  return true;
}

function extractDocumentRevisionId(candidate: MigrationSourceCandidate): string | null {
  if (candidate.sourceType !== "issue_documents") return null;
  const [revisionId] = candidate.sourceId.split(":", 1);
  return revisionId?.trim() ? revisionId : null;
}

function candidateSessionProvenanceKey(candidate: MigrationSourceCandidate): string | null {
  if (candidate.sourceType === "issue_comments") {
    return `comment:${candidate.sourceId}`;
  }
  if (candidate.sourceType === "issue_documents") {
    const revisionId = extractDocumentRevisionId(candidate);
    const sectionKey = typeof candidate.metadata.sectionKey === "string" ? candidate.metadata.sectionKey : null;
    if (!revisionId || !sectionKey) return null;
    return `document:${revisionId}:${sectionKey}`;
  }
  return null;
}

function metadataSessionProvenanceKeys(metadata: Record<string, unknown>): string[] {
  const keys: string[] = [];
  if (typeof metadata.commentId === "string" && metadata.commentId.trim()) {
    keys.push(`comment:${metadata.commentId}`);
  }
  if (
    typeof metadata.documentRevisionId === "string"
    && metadata.documentRevisionId.trim()
    && typeof metadata.sectionKey === "string"
    && metadata.sectionKey.trim()
  ) {
    keys.push(`document:${metadata.documentRevisionId}:${metadata.sectionKey}`);
  }
  return keys;
}

function coveredCommentIds(
  candidates: MigrationSourceCandidate[],
  lastSyncedCommentId: string | null,
  lastSyncedCommentCreatedAt: string | null,
): Set<string> {
  if (!lastSyncedCommentId && !lastSyncedCommentCreatedAt) {
    return new Set<string>();
  }
  const cutoff = lastSyncedCommentCreatedAt ? Date.parse(lastSyncedCommentCreatedAt) : Number.NaN;
  const covered = new Set<string>();
  let matchedLastSynced = false;
  for (const candidate of candidates) {
    if (candidate.sourceType !== "issue_comments") continue;
    if (Number.isFinite(cutoff) && Date.parse(candidate.createdAt) <= cutoff) {
      covered.add(candidate.sourceId);
    }
    if (candidate.sourceId === lastSyncedCommentId) {
      covered.add(candidate.sourceId);
      matchedLastSynced = true;
      break;
    }
  }
  if (matchedLastSynced || Number.isFinite(cutoff)) {
    return covered;
  }
  return new Set<string>();
}

function coveredDocumentRevisionIds(
  candidates: MigrationSourceCandidate[],
  lastSyncedDocumentRevisionId: string | null,
): Set<string> {
  if (!lastSyncedDocumentRevisionId) {
    return new Set<string>();
  }
  const covered = new Set<string>();
  for (const candidate of candidates) {
    const revisionId = extractDocumentRevisionId(candidate);
    if (!revisionId) continue;
    covered.add(revisionId);
    if (revisionId === lastSyncedDocumentRevisionId) {
      return covered;
    }
  }
  return new Set<string>();
}

async function filterAlreadySyncedMigrationCandidates(
  ctx: PluginContext,
  candidates: MigrationSourceCandidate[],
): Promise<MigrationSourceCandidate[]> {
  const byIssue = new Map<string, MigrationSourceCandidate[]>();
  for (const candidate of candidates) {
    if (!candidate.issueId) continue;
    const existing = byIssue.get(candidate.issueId) ?? [];
    existing.push(candidate);
    byIssue.set(candidate.issueId, existing);
  }

  const coverage = new Map<string, { commentIds: Set<string>; revisionIds: Set<string> }>();
  for (const [issueId, issueCandidates] of byIssue.entries()) {
    const status = await getIssueSyncStatus(ctx, issueId);
    coverage.set(issueId, {
      commentIds: coveredCommentIds(issueCandidates, status.lastSyncedCommentId, status.lastSyncedCommentCreatedAt),
      revisionIds: coveredDocumentRevisionIds(issueCandidates, status.lastSyncedDocumentRevisionId),
    });
    const syncedRevisions = resolveSyncedDocumentRevisions(status);
    for (const candidate of issueCandidates) {
      const documentKey = candidate.metadata.documentKey;
      if (candidate.sourceType === "issue_documents" && typeof documentKey === "string") {
        candidate.documentCursorAtCollection = syncedRevisions[documentKey] ?? null;
      }
    }
  }

  return candidates.filter((candidate) => {
    if (!candidate.issueId) return true;
    const issueCoverage = coverage.get(candidate.issueId);
    if (!issueCoverage) return true;
    if (candidate.sourceType === "issue_comments") {
      return !issueCoverage.commentIds.has(candidate.sourceId);
    }
    if (candidate.sourceType === "issue_documents") {
      const revisionId = extractDocumentRevisionId(candidate);
      return !revisionId || !issueCoverage.revisionIds.has(revisionId);
    }
    return true;
  });
}

// Initialization can take many calls. An issue sync that ran after a document
// candidate was collected recorded the document's newest revision then, at
// least as new as the candidate's, and owns the document from then on.
function documentSyncedSinceCollection(status: IssueSyncStatus, candidate: MigrationSourceCandidate): boolean {
  const documentKey = candidate.metadata.documentKey;
  if (candidate.sourceType !== "issue_documents" || typeof documentKey !== "string") return false;
  const synced = resolveSyncedDocumentRevisions(status)[documentKey] ?? null;
  return synced !== (candidate.documentCursorAtCollection ?? null) && synced !== candidate.metadata.documentRevisionId;
}

export function setMigrationCandidatesLoaderForTests(loader: MigrationCandidatesLoader | null) {
  migrationCandidatesLoaderOverride = loader;
}

async function runIssueSyncExclusive<T>(companyId: string, issueId: string, work: () => Promise<T>): Promise<T> {
  const queueKey = `${companyId}:${issueId}`;
  const previous = issueSyncQueue.get(queueKey) ?? Promise.resolve();
  let release: () => void = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => current);
  issueSyncQueue.set(queueKey, queued);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (issueSyncQueue.get(queueKey) === queued) {
      issueSyncQueue.delete(queueKey);
    }
  }
}

export function getIssueSyncQueueSizeForTests(): number {
  return issueSyncQueue.size;
}

function buildMigrationPreview(companyId: string, candidates: MigrationSourceCandidate[]): MigrationPreview {
  const comments = candidates.filter((candidate) => candidate.sourceType === "issue_comments");
  const documents = candidates.filter((candidate) => candidate.sourceType === "issue_documents");
  const files = candidates.filter((candidate) => !["issue_comments", "issue_documents"].includes(candidate.sourceType));
  const issueMap = new Map<string, MigrationPreview["issues"][number]>();
  const warnings: string[] = [];
  if (comments.length === 0) {
    warnings.push("No issue comments were found for this company.");
  }
  if (documents.length === 0) {
    warnings.push("No issue document revisions were found for this company.");
  }
  for (const candidate of candidates) {
    if (!candidate.issueId) continue;
    const existing = issueMap.get(candidate.issueId) ?? {
      issueId: candidate.issueId,
      issueIdentifier: candidate.issueIdentifier,
      issueTitle: typeof candidate.metadata.issueTitle === "string" ? candidate.metadata.issueTitle : null,
      commentCount: 0,
      documentCount: 0,
      estimatedMessages: 0,
    };
    if (candidate.sourceType === "issue_comments") {
      existing.commentCount += 1;
    } else if (candidate.sourceType === "issue_documents") {
      existing.documentCount += 1;
    }
    existing.estimatedMessages += 1;
    issueMap.set(candidate.issueId, existing);
  }
  const issues = Array.from(issueMap.values()).sort((left, right) => {
    if (right.estimatedMessages !== left.estimatedMessages) {
      return right.estimatedMessages - left.estimatedMessages;
    }
    return (left.issueIdentifier ?? left.issueId).localeCompare(right.issueIdentifier ?? right.issueId);
  });
  return {
    companyId,
    sourceTypes: Array.from(new Set(candidates.map((candidate) => candidate.sourceType))),
    totals: {
      comments: comments.length,
      documents: documents.length,
      files: files.length,
    },
    issues,
    estimatedMessages: candidates.length,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}

async function patchJobProgress(
  ctx: PluginContext,
  companyId: string,
  patch: Parameters<typeof patchCompanyCheckpoint>[2],
) {
  return await patchCompanyCheckpoint(ctx, companyId, {
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

async function buildMemoryStatusData(ctx: PluginContext, companyId: string): Promise<MemoryStatusData> {
  const config = await getResolvedConfig(ctx, companyId);
  const validation = validateConfig(config);
  const [companyStatus, counts, checkpoints, jobs] = await Promise.all([
    getCompanySyncStatus(ctx, companyId),
    listMappingCounts(ctx, companyId),
    getCompanyCheckpoint(ctx, companyId),
    Promise.resolve(listJobsForUi(ctx)),
  ]);

  return {
    config,
    validation: {
      ok: validation.ok,
      warnings: validation.warnings ?? [],
      errors: validation.errors ?? [],
    },
    companyId,
    companyStatus,
    counts,
    checkpoints,
    jobs,
  };
}

// The import ledger is a best-effort optimization layered on top of the
// authoritative, scope-independent dedup sources (the per-run provenance cache
// and Honcho's own session messages). The host's per-job invocation scope can
// expire mid-import on a large company, which makes ctx.entities calls throw;
// letting a ledger read/write failure abort the whole import would both stop it
// early and — because the append already happened — risk a duplicate on the
// next run. Swallowing those failures lets the import keep going and stay
// idempotent via provenance instead.
async function safeGetImportLedgerRecord(ctx: PluginContext, companyId: string, externalId: string) {
  try {
    return await getImportLedgerRecord(ctx, companyId, externalId);
  } catch {
    return null;
  }
}

async function safeUpsertImportLedger(ctx: PluginContext, companyId: string, input: Parameters<typeof upsertImportLedger>[2]) {
  try {
    await upsertImportLedger(ctx, companyId, input);
  } catch {
    // Non-fatal: provenance-based dedup still prevents re-import.
  }
}

async function ensureMigrationCandidateImported(
  ctx: PluginContext,
  companyId: string,
  candidate: MigrationSourceCandidate,
  config: HonchoResolvedConfig,
  client: Awaited<ReturnType<typeof createHonchoClient>>,
  sessionProvenanceCache: Map<string, Set<string>>,
) {
  const externalId = candidate.sourceType === "issue_comments"
    ? `paperclip:comment:${candidate.sourceId}`
    : candidate.sourceType === "issue_documents"
      ? `paperclip:document:${candidate.sourceId}`
      : candidate.workspaceId && candidate.metadata.relativePath
        ? fileExternalId(candidate.workspaceId, String(candidate.metadata.relativePath))
        : candidate.sourceId;
  const existing = await safeGetImportLedgerRecord(ctx, companyId, externalId);
  if (existing && existing.data.fingerprint === candidate.fingerprint) {
    return { imported: false, skipped: true };
  }

  const company = await ctx.companies.get(companyId);
  const workspaceId = await client.ensureCompanyWorkspace(companyId, company);
  await upsertWorkspaceMapping(ctx, company, companyId, config.workspacePrefix, "mapped", workspaceId);

  if (candidate.issueId) {
    const issue = await ctx.issues.get(candidate.issueId, companyId);
    if (!issue) {
      return { imported: false, skipped: true };
    }
    await client.ensureIssueSession(issue, company);
    await upsertSessionMapping(ctx, issue, workspaceId);

    const candidateProvenanceKey = candidateSessionProvenanceKey(candidate);
    let existingSessionProvenance = sessionProvenanceCache.get(issue.id);
    if (!existingSessionProvenance) {
      const sessionId = await resolveCanonicalIssueSessionId(
        ctx,
        issue.id,
        issue.identifier ?? null,
      );
      const metadataItems = await client.listSessionMessageMetadata(companyId, sessionId);
      existingSessionProvenance = new Set(metadataItems.flatMap((metadata) => metadataSessionProvenanceKeys(metadata)));
      sessionProvenanceCache.set(issue.id, existingSessionProvenance);
    }
    if (candidateProvenanceKey && existingSessionProvenance.has(candidateProvenanceKey)) {
      await safeUpsertImportLedger(ctx, companyId, {
        sourceType: candidate.sourceType === "issue_comments" ? "issue_comment" : candidate.sourceType === "issue_documents" ? "issue_document" : "run_transcript",
        externalId,
        fingerprint: candidate.fingerprint,
        issueId: candidate.issueId,
        issueIdentifier: candidate.issueIdentifier,
        importedAt: new Date().toISOString(),
        metadata: candidate.metadata,
      });
      return { imported: false, skipped: true };
    }

    const actor: HonchoActor = {
      authorType: candidate.authorType,
      authorId: candidate.authorId,
    };
    await ensureActorPeer(ctx, companyId, actor, client);
    await ensureActorPeerMapping(ctx, companyId, actor);

    await client.appendMessages(companyId, issue.id, [{
      content: candidate.content,
      peerId: await resolvePeerIdFromActor(ctx, companyId, actor),
      createdAt: candidate.createdAt,
      metadata: candidate.metadata as HonchoMessageInput["metadata"],
    }]);

    // Mark this source as present in the session immediately after the append
    // succeeds, before the (best-effort, scope-dependent) ledger write — so a
    // ledger-write failure can never leave a same-run duplicate uncaught.
    if (candidateProvenanceKey) {
      existingSessionProvenance.add(candidateProvenanceKey);
    }

    await safeUpsertImportLedger(ctx, companyId, {
      sourceType: candidate.sourceType === "issue_comments" ? "issue_comment" : candidate.sourceType === "issue_documents" ? "issue_document" : "run_transcript",
      externalId,
      fingerprint: candidate.fingerprint,
      issueId: candidate.issueId,
      issueIdentifier: candidate.issueIdentifier,
      importedAt: new Date().toISOString(),
      metadata: candidate.metadata,
    });
  } else {
    const isGuidance = candidate.sourceType === "workspace_guidance_files";
    const isAgentProfile = candidate.sourceType === "agent_profile_files";
    const agentProfileId = isAgentProfile && typeof candidate.metadata.authorId === "string"
      ? String(candidate.metadata.authorId).replace(/^agent:/, "")
      : null;
    const agentProfile = agentProfileId ? await ctx.agents.get(agentProfileId, companyId) : null;
    const peerId = isGuidance
      ? systemPeerId()
      : agentProfile
        ? await resolveCanonicalAgentPeerId(ctx, companyId, agentProfile)
        : ownerPeerIdForCompany(companyId);
    if (isGuidance) {
      await client.ensurePeer(companyId, peerId, {
        company_id: companyId,
        system_id: "paperclip",
      });
      await upsertSystemPeerMapping(ctx, companyId);
    } else if (agentProfile) {
      await client.ensureAgentPeer(companyId, agentProfile);
      await upsertAgentPeerMapping(ctx, companyId, agentProfile);
    } else {
      await client.ensurePeer(companyId, peerId, {
        company_id: companyId,
        owner_id: companyId,
      });
      await upsertOwnerPeerMapping(ctx, companyId);
    }
    const sessionId = agentProfileId
      ? bootstrapSessionIdForAgent(agentProfileId)
      : bootstrapSessionIdForCompany(companyId);
    await client.ensureRawSession(companyId, sessionId, {
      source_system: "paperclip",
      company_id: companyId,
      session_role: isAgentProfile ? "agent_profile" : "bootstrap",
    });
    await upsertBootstrapSessionMapping(ctx, companyId, {
      kind: isAgentProfile ? "agent" : "company",
      agentId: agentProfileId ?? undefined,
      title: isGuidance ? "Workspace Guidance" : "Legacy Memory",
      workspaceId,
    });
    await upsertFileImportSource(ctx, companyId, {
      workspaceId: candidate.workspaceId ?? workspaceId,
      projectId: candidate.projectId ?? "unknown",
      relativePath: String(candidate.metadata.relativePath ?? candidate.title),
      sourceCategory: String(candidate.sourceCategory ?? "legacy-user-memory"),
    });
    await client.appendMessagesToSession(companyId, sessionId, [{
      content: candidate.content,
      peerId,
      createdAt: candidate.createdAt,
      metadata: candidate.metadata as HonchoMessageInput["metadata"],
    }]);
    await upsertImportLedger(ctx, companyId, {
      sourceType: isGuidance ? "workspace_guidance_file" : isAgentProfile ? "agent_profile_file" : "legacy_memory_file",
      externalId,
      fingerprint: candidate.fingerprint,
      issueId: candidate.issueId ?? sessionId,
      issueIdentifier: candidate.issueIdentifier,
      importedAt: new Date().toISOString(),
      metadata: candidate.metadata,
    });
  }

  return { imported: true, skipped: false };
}

export async function scanMigrationSources(
  ctx: PluginContext,
  companyId: string,
  candidates?: MigrationSourceCandidate[],
): Promise<MigrationPreview> {
  await patchCompanySyncStatus(ctx, companyId, {
    migrationStatus: "scanned",
    lastError: null,
  });
  await patchJobProgress(ctx, companyId, {
    activeJobKey: "migration-scan",
    status: "running",
    processed: 0,
    succeeded: 0,
    skipped: 0,
    failed: 0,
    currentSourceType: null,
    currentEntityId: null,
    lastError: null,
  });

  try {
    const preview = buildMigrationPreview(companyId, candidates ?? await loadMigrationCandidates(ctx, companyId));
    await patchCompanySyncStatus(ctx, companyId, {
      migrationStatus: "preview_ready",
      latestMigrationPreview: preview,
      lastError: null,
    });
    await upsertMigrationReport(ctx, companyId, "preview", buildMigrationReportPayload(companyId, preview));
    await patchJobProgress(ctx, companyId, {
      activeJobKey: "migration-scan",
      status: "complete",
      processed: preview.estimatedMessages,
      succeeded: preview.estimatedMessages,
      currentSourceType: null,
      currentEntityId: null,
    });
    return preview;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await patchCompanySyncStatus(ctx, companyId, {
      migrationStatus: "failed",
      lastError: buildSyncErrorSummary({ message }),
      pendingFailureCount: (await getCompanySyncStatus(ctx, companyId)).pendingFailureCount + 1,
    });
    await patchJobProgress(ctx, companyId, {
      activeJobKey: "migration-scan",
      status: "failed",
      lastError: message,
    });
    throw error;
  }
}

// Returns null when it stopped with candidates left, at the deadline or because
// the host refused the call. Progress so far is kept: imported items are in
// the ledger, issue cursors are advanced, and with a run, run.pending holds
// only what is left, so the next call goes on from there. Counts accumulate in
// the run across calls.
export async function importMigrationPreview(
  ctx: PluginContext,
  companyId: string,
  deadline?: number,
  run?: InitializationRun,
) {
  const config = await getResolvedConfig(ctx, companyId);
  const validation = validateConfig(config);
  if (!validation.ok) {
    throw new Error(validation.errors?.join("; ") ?? "Honcho config is invalid");
  }
  let candidates = run
    ? run.pending ??= await loadMigrationCandidates(ctx, companyId)
    : await loadMigrationCandidates(ctx, companyId);
  const preview = (await getCompanySyncStatus(ctx, companyId)).latestMigrationPreview
    ?? await scanMigrationSources(ctx, companyId, candidates);
  const client = await createHonchoClient({ ctx, config });
  const sessionProvenanceCache = new Map<string, Set<string>>();
  const totals: InitializationRun["imported"] = run?.imported
    ?? { processed: 0, succeeded: 0, skipped: 0, failed: 0, firstError: null };
  let handled = 0;
  let outOfTime = false;

  // Track, per issue, the content this import confirmed is in Honcho (whether
  // freshly imported or already present) so we can advance that issue's
  // event-sync cursors afterward. Without this, migration import and the
  // event-driven syncIssue path keep independent dedup state, so the first
  // syncIssue after an initialize-memory re-appends every comment migration
  // already imported.
  type IssueCursorSeed = {
    latestCommentId?: string;
    latestCommentCreatedAt?: string;
    // Document key -> the covered candidate of that document's revision.
    documentRevisions: Record<string, MigrationSourceCandidate>;
  };
  const issueSeeds = new Map<string, IssueCursorSeed>();
  const recordCoveredCandidate = (candidate: MigrationSourceCandidate) => {
    if (!candidate.issueId) return;
    const issueId = candidate.issueId;
    const seed = issueSeeds.get(issueId) ?? { documentRevisions: {} };
    if (candidate.sourceType === "issue_comments") {
      // Candidates are globally sorted by createdAt ascending, so a later
      // covered comment is always at least as recent as the current seed.
      if (
        !seed.latestCommentCreatedAt
        || Date.parse(candidate.createdAt) >= Date.parse(seed.latestCommentCreatedAt)
      ) {
        seed.latestCommentId = candidate.sourceId;
        seed.latestCommentCreatedAt = candidate.createdAt;
      }
    } else if (candidate.sourceType === "issue_documents") {
      const documentKey = typeof candidate.metadata.documentKey === "string" ? candidate.metadata.documentKey : null;
      const revisionId = typeof candidate.metadata.documentRevisionId === "string" ? candidate.metadata.documentRevisionId : null;
      if (documentKey && revisionId) {
        seed.documentRevisions[documentKey] = candidate;
      }
    }
    issueSeeds.set(issueId, seed);
  };

  await patchCompanySyncStatus(ctx, companyId, {
    migrationStatus: "running",
    lastError: null,
  });
  await patchJobProgress(ctx, companyId, {
    activeJobKey: "migration-import",
    status: "running",
    processed: totals.processed,
    succeeded: totals.succeeded,
    skipped: totals.skipped,
    failed: totals.failed,
    currentSourceType: null,
    currentEntityId: null,
    lastError: null,
  });

  try {
    while (handled < candidates.length) {
      const candidate = candidates[handled]!;
      await patchJobProgress(ctx, companyId, {
        activeJobKey: "migration-import",
        processed: totals.processed + 1,
        succeeded: totals.succeeded,
        skipped: totals.skipped,
        failed: totals.failed,
        currentSourceType: candidate.sourceType,
        currentEntityId: candidate.sourceId,
      });
      try {
        if (
          candidate.sourceType === "issue_documents"
          && candidate.issueId
          && documentSyncedSinceCollection(await getIssueSyncStatus(ctx, candidate.issueId), candidate)
        ) {
          totals.skipped += 1;
        } else {
          const result = await ensureMigrationCandidateImported(ctx, companyId, candidate, config, client, sessionProvenanceCache);
          if (result.imported) {
            totals.succeeded += 1;
          } else {
            totals.skipped += 1;
          }
          // Imported or skipped-because-already-present both mean this content is
          // in Honcho, so it should count toward advancing the issue's sync cursor.
          recordCoveredCandidate(candidate);
        }
      } catch (error) {
        // Once the host gives up on the call it refuses the worker's
        // company-scoped requests, so an error past the deadline, or a refused
        // scope, says nothing about this candidate. Leave it for the next call.
        if (pastDeadline(deadline) || isInvocationScopeDenied(error)) {
          outOfTime = true;
          break;
        }
        // Counted and reported at the end. An issue's sync cursor must not pass
        // a comment that is not in Honcho, or neither a later initialization
        // nor the next issue sync imports it. So the issue's later candidates
        // are left to those too; both start again from this one.
        const left = candidates.length;
        candidates = candidates.filter((later, index) =>
          index <= handled || !candidate.issueId || later.issueId !== candidate.issueId);
        totals.failed += 1 + left - candidates.length;
        totals.processed += left - candidates.length;
        totals.firstError ??= error instanceof Error ? error.message : String(error);
      }
      totals.processed += 1;
      handled += 1;
      // Stop at the deadline, but never between two candidates with the same
      // timestamp: the issue cursors advanced below mark every comment up to the
      // latest covered timestamp as imported.
      const next = candidates[handled];
      if (next && next.createdAt !== candidate.createdAt && pastDeadline(deadline)) {
        outOfTime = true;
        break;
      }
    }
  } finally {
    if (run) run.pending = candidates.slice(handled);
    // Advance each affected issue's event-sync cursors to reflect the content
    // migration just confirmed is in Honcho. Advance-only: never regress a
    // cursor an event sync may have already moved further forward. This runs
    // even when the loop throws: once the host gives up on an action it refuses
    // the worker's company-scoped calls, but these issue-scoped writes still go
    // through, so the next event sync does not append the same content again.
    for (const [issueId, seed] of issueSeeds) {
      const current = await getIssueSyncStatus(ctx, issueId);
      const patch: Partial<IssueSyncStatus> = {};
      if (
        seed.latestCommentId
        && seed.latestCommentCreatedAt
        && (
          !current.lastSyncedCommentCreatedAt
          || Date.parse(seed.latestCommentCreatedAt) >= Date.parse(current.lastSyncedCommentCreatedAt)
        )
      ) {
        patch.lastSyncedCommentId = seed.latestCommentId;
        patch.lastSyncedCommentCreatedAt = seed.latestCommentCreatedAt;
      }
      const documents = Object.entries(seed.documentRevisions)
        .filter(([, candidate]) => !documentSyncedSinceCollection(current, candidate));
      if (documents.length > 0) {
        const synced = { ...resolveSyncedDocumentRevisions(current) };
        for (const [documentKey, candidate] of documents) {
          synced[documentKey] = String(candidate.metadata.documentRevisionId);
        }
        patch.syncedDocumentRevisions = synced;
      }
      if (Object.keys(patch).length > 0) {
        await patchIssueSyncStatus(ctx, issueId, patch);
      }
    }
  }
  if (outOfTime) return null;

  const { processed, succeeded, skipped, failed, firstError } = totals;
  const report = {
    companyId,
    preview,
    summary: {
      commentsImported: await listMappingCounts(ctx, companyId).then((counts) => counts.importedComments),
      documentsImported: await listMappingCounts(ctx, companyId).then((counts) => counts.importedDocuments),
      skipped,
      failed,
    },
    completedAt: new Date().toISOString(),
  };
  await upsertMigrationReport(ctx, companyId, "import", report);

  const counts = await listMappingCounts(ctx, companyId);
  await patchCompanySyncStatus(ctx, companyId, {
    connectionStatus: "connected",
    migrationStatus: failed > 0 ? "partial" : "complete",
    lastSuccessfulSyncAt: new Date().toISOString(),
    lastError: firstError ? buildSyncErrorSummary({ message: firstError }) : null,
    pendingFailureCount: failed > 0 ? (await getCompanySyncStatus(ctx, companyId)).pendingFailureCount + 1 : 0,
  });
  await patchJobProgress(ctx, companyId, {
    activeJobKey: "migration-import",
    status: failed > 0 ? "failed" : "complete",
    processed,
    succeeded,
    skipped,
    failed,
    currentSourceType: null,
    currentEntityId: null,
    lastError: firstError,
  });
  return counts;
}

export type InitializeMemoryResult = {
  // Null while work is left: the call stopped at its deadline.
  report: InitializationReport | null;
  // Grows while the initialization moves on (see initializationProgress).
  progress: number;
};

/**
 * Initializes Honcho memory for one company. Past `deadline` (epoch ms) it
 * stops starting new work, saves progress and returns a null report. Calling
 * it again resumes where it stopped.
 */
export async function initializeMemory(
  ctx: PluginContext,
  companyId: string,
  options: { deadline?: number } = {},
): Promise<InitializeMemoryResult> {
  if (initializingCompanies.has(companyId)) {
    throw new Error("Honcho memory initialization is already running for this company");
  }
  initializingCompanies.add(companyId);
  try {
    return await runInitializeMemory(ctx, companyId, options.deadline);
  } finally {
    initializingCompanies.delete(companyId);
  }
}

async function pauseInitialization(
  ctx: PluginContext,
  companyId: string,
  run: InitializationRun,
): Promise<InitializeMemoryResult> {
  // Nothing runs until the settings page calls again, so do not leave the
  // migration or the checkpoint showing "running".
  const status = await getCompanySyncStatus(ctx, companyId);
  await patchCompanySyncStatus(ctx, companyId, {
    initializationStatus: "partial",
    ...(status.migrationStatus === "running" ? { migrationStatus: "partial" as const } : {}),
  });
  await patchJobProgress(ctx, companyId, { status: "idle" });
  return { report: null, progress: initializationProgress(run) };
}

async function runInitializeMemory(
  ctx: PluginContext,
  companyId: string,
  deadline: number | undefined,
): Promise<InitializeMemoryResult> {
  const config = await getResolvedConfig(ctx, companyId);
  const validation = validateConfig(config);
  if (!validation.ok) {
    await patchCompanySyncStatus(ctx, companyId, {
      connectionStatus: "auth_failed",
      initializationStatus: "failed",
      promptContextStatus: "inactive",
      pendingFailureCount: (await getCompanySyncStatus(ctx, companyId)).pendingFailureCount + 1,
      lastError: buildSyncErrorSummary({
        message: validation.errors?.join("; ") ?? "Honcho config is invalid",
      }),
    });
    throw new Error(validation.errors?.join("; ") ?? "Honcho config is invalid");
  }

  const run = initializationRunFor(ctx, companyId, config);
  const company = await ctx.companies.get(companyId);
  const client = await createHonchoClient({ ctx, config });

  await patchCompanySyncStatus(ctx, companyId, {
    connectionStatus: "connected",
    initializationStatus: "running",
    workspaceStatus: "unknown",
    peerStatus: "not_started",
    lastError: null,
  });
  await patchJobProgress(ctx, companyId, {
    activeJobKey: "initialize-memory",
    status: "running",
    processed: 0,
    succeeded: 0,
    skipped: 0,
    failed: 0,
    currentSourceType: null,
    currentEntityId: null,
    lastError: null,
  });

  try {
    // repairMappings must run before probeConnection: it ensures a workspace
    // mapping and any missing peer/session mappings exist (self-healing a
    // company that has issues/agents but never completed initialization)
    // without ever changing an already-established mapping's ids.
    if (!(await repairMappings(ctx, companyId, deadline, run)).done) {
      return await pauseInitialization(ctx, companyId, run);
    }
    await client.probeConnection(companyId, company);
    const workspaceId = await client.ensureCompanyWorkspace(companyId, company);

    if (!run.pending) {
      if (!(await collectMigrationCandidates(ctx, companyId, config, run, deadline))) {
        return await pauseInitialization(ctx, companyId, run);
      }
      await scanMigrationSources(ctx, companyId, run.pending!);
    }
    const countsBefore = await listMappingCounts(ctx, companyId);
    const importedThisCall = run.pending!.length > 0;
    if (!(await importMigrationPreview(ctx, companyId, deadline, run))) {
      return await pauseInitialization(ctx, companyId, run);
    }
    // The import may have used the whole budget. The prompt-context probe can
    // sync an issue and call Honcho several times, so leave it to the next call.
    if (importedThisCall && pastDeadline(deadline)) {
      return await pauseInitialization(ctx, companyId, run);
    }
    const probe = await probePromptContext(ctx, companyId, {
      issueId: run.issues?.[0]?.id ?? null,
      agentId: run.agents?.[0]?.id ?? null,
    });

    const counts = await listMappingCounts(ctx, companyId);
    const { skipped, failed, firstError } = run.imported;
    const report: InitializationReport = {
      companyId,
      workspace: {
        id: workspaceId,
        status: countsBefore.mappedSessions > 0 ? "existing" : "created",
      },
      peers: {
        mapped: counts.mappedPeers,
        status: counts.mappedPeers > 0 ? "complete" : "partial",
      },
      importSummary: {
        comments: counts.importedComments,
        documents: counts.importedDocuments,
        skipped,
        failed,
      },
      promptContext: {
        status: probe.status,
        preview: probe.preview,
      },
      completedAt: new Date().toISOString(),
    };
    await upsertMigrationReport(ctx, companyId, "initialization", report);
    await patchCompanySyncStatus(ctx, companyId, {
      connectionStatus: "connected",
      workspaceStatus: "created",
      peerStatus: counts.mappedPeers > 0 ? "complete" : "partial",
      initializationStatus: "complete",
      // Keep what the import reported about items it could not import.
      migrationStatus: failed > 0 ? "partial" : "complete",
      promptContextStatus: probe.status,
      lastSuccessfulSyncAt: new Date().toISOString(),
      lastError: firstError ? buildSyncErrorSummary({ message: firstError }) : null,
      ...(failed > 0 ? {} : { pendingFailureCount: 0 }),
      lastInitializationReport: report,
    });
    await patchJobProgress(ctx, companyId, {
      activeJobKey: "initialize-memory",
      status: "complete",
      processed: counts.importedComments + counts.importedDocuments,
      succeeded: counts.importedComments + counts.importedDocuments,
      skipped,
      failed,
      currentSourceType: null,
      currentEntityId: null,
      lastError: firstError,
    });
    dropInitializationRun(ctx, companyId);
    return { report, progress: initializationProgress(run) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await patchCompanySyncStatus(ctx, companyId, {
      connectionStatus: message.includes("secret ref") ? "auth_failed" : "connected",
      initializationStatus: "failed",
      promptContextStatus: "inactive",
      pendingFailureCount: (await getCompanySyncStatus(ctx, companyId)).pendingFailureCount + 1,
      lastError: buildSyncErrorSummary({ message }),
    });
    await patchJobProgress(ctx, companyId, {
      activeJobKey: "initialize-memory",
      status: "failed",
      lastError: message,
    });
    throw error;
  }
}

export async function syncIssue(
  ctx: PluginContext,
  issueId: string,
  companyId: string,
  options: SyncIssueOptions = {},
): Promise<SyncIssueResult> {
  return await runIssueSyncExclusive(companyId, issueId, async () => {
    const config = await getResolvedConfig(ctx, companyId);
    const status = await getIssueSyncStatus(ctx, issueId);
    const replay = options.replay === true;
    const resources = await fetchIssueResources(ctx, issueId, companyId, config);
    const client = await createHonchoClient({ ctx, config });

    await patchIssueSyncStatus(ctx, issueId, {
      replayInProgress: replay,
      replayRequestedAt: replay ? new Date().toISOString() : status.replayRequestedAt,
    });

    try {
      await ensureIssueTopology(ctx, resources, client, config);

      const commentMessages = config.syncIssueComments
        ? await buildCommentMessages(ctx, resources.issue, resources.comments, config, replay, replay ? null : status.lastSyncedCommentId)
        : [];
      const documentMessages = config.syncIssueDocuments
        ? await buildDocumentMessages(ctx, resources.issue, resources.documents, config, replay, resolveSyncedDocumentRevisions(status))
        : [];
      const allMessages = [...commentMessages, ...documentMessages];
      if (allMessages.length > 0) {
        await client.appendMessages(resources.issue.companyId, resources.issue.id, allMessages);
      } else {
        await client.ensureIssueSession(resources.issue, resources.company);
      }

      const lastComment = resources.comments.at(-1) ?? null;
      const lastDocumentRevision = resources.documents.flatMap((bundle) => bundle.revisions).sort(compareRevisions).at(-1) ?? null;
      // Every document currently on the issue has its latest revision in Honcho
      // after a successful append (freshly synced this pass, or synced earlier
      // and skipped). Record each document's revision id so the next sync only
      // re-emits documents whose revision actually changed.
      const nextSyncedDocumentRevisions: Record<string, string> = { ...resolveSyncedDocumentRevisions(status) };
      if (config.syncIssueDocuments) {
        for (const bundle of resources.documents) {
          for (const revision of bundle.revisions) {
            nextSyncedDocumentRevisions[bundle.document.key] = revision.id;
          }
        }
      }
      const context = await refreshContextPreview(ctx, resources.issue, resources.company, config, client);
      await patchIssueSyncStatus(ctx, issueId, {
        lastSyncedCommentId: lastComment?.id ?? status.lastSyncedCommentId,
        lastSyncedCommentCreatedAt: lastComment ? new Date(lastComment.createdAt).toISOString() : status.lastSyncedCommentCreatedAt,
        lastSyncedDocumentRevisionKey: lastDocumentRevision?.key ?? status.lastSyncedDocumentRevisionKey,
        lastSyncedDocumentRevisionId: lastDocumentRevision?.id ?? status.lastSyncedDocumentRevisionId,
        syncedDocumentRevisions: nextSyncedDocumentRevisions,
        lastBackfillAt: new Date().toISOString(),
        replayInProgress: false,
        lastError: null,
        latestAppendAt: allMessages.length > 0 ? new Date().toISOString() : status.latestAppendAt,
        latestContextPreview: context.preview,
        latestContextFetchedAt: new Date().toISOString(),
      });
      await patchCompanySyncStatus(ctx, companyId, {
        connectionStatus: "connected",
        workspaceStatus: "mapped",
        peerStatus: "partial",
        lastSuccessfulSyncAt: new Date().toISOString(),
        lastError: null,
      });
      return {
        issueId: resources.issue.id,
        issueIdentifier: resources.issue.identifier ?? null,
        syncedComments: commentMessages.length,
        syncedDocumentSections: documentMessages.length,
        syncedRuns: 0,
        lastSyncedCommentId: lastComment?.id ?? null,
        lastSyncedRunId: null,
        replayed: replay,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const previous = await getCompanySyncStatus(ctx, companyId);
      await patchCompanySyncStatus(ctx, companyId, {
        pendingFailureCount: previous.pendingFailureCount + 1,
        lastError: buildSyncErrorSummary({
          message,
          issueId,
          commentId: options.commentIdHint ?? null,
          documentKey: options.documentKeyHint ?? null,
        }),
      });
      await patchIssueSyncStatus(ctx, issueId, {
        replayInProgress: false,
        lastError: buildSyncErrorSummary({
          message,
          issueId,
          commentId: options.commentIdHint ?? null,
          documentKey: options.documentKeyHint ?? null,
        }),
      });
      throw error;
    }
  });
}

export async function replayIssue(ctx: PluginContext, issueId: string, companyId: string): Promise<SyncIssueResult> {
  await clearIssueSyncStatus(ctx, issueId);
  return await syncIssue(ctx, issueId, companyId, { replay: true });
}

export async function loadIssueStatusData(ctx: PluginContext, issueId: string, companyId: string) {
  const config = await getResolvedConfig(ctx, companyId);
  const issue = await ctx.issues.get(issueId, companyId);
  if (!issue) {
    throw new Error("Issue not found");
  }
  const status = await getIssueSyncStatus(ctx, issueId);
  return {
    syncEnabled: config.syncIssueComments || config.syncIssueDocuments,
    issueId,
    issueIdentifier: issue.identifier ?? null,
    lastSyncedCommentId: status.lastSyncedCommentId,
    lastSyncedCommentCreatedAt: status.lastSyncedCommentCreatedAt,
    lastSyncedDocumentRevisionKey: status.lastSyncedDocumentRevisionKey,
    lastSyncedDocumentRevisionId: status.lastSyncedDocumentRevisionId,
    lastSyncedRunId: status.lastSyncedRunId,
    lastSyncedRunFinishedAt: status.lastSyncedRunFinishedAt,
    lastBackfillAt: status.lastBackfillAt,
    replayRequestedAt: status.replayRequestedAt,
    replayInProgress: status.replayInProgress,
    lastError: status.lastError,
    contextPreview: status.latestContextPreview,
    contextFetchedAt: status.latestContextFetchedAt,
    latestAppendAt: status.latestAppendAt,
    latestPromptContextPreview: status.latestPromptContextPreview,
    latestPromptContextBuiltAt: status.latestPromptContextBuiltAt,
    config: {
      syncIssueComments: config.syncIssueComments,
      syncIssueDocuments: config.syncIssueDocuments,
      enablePromptContext: config.enablePromptContext,
      enablePeerChat: config.enablePeerChat,
      observe_me: config.observe_me,
      observe_others: config.observe_others,
    },
  };
}

export async function loadMemoryStatusData(ctx: PluginContext, companyId: string) {
  return await buildMemoryStatusData(ctx, companyId);
}

export async function loadMigrationPreviewData(ctx: PluginContext, companyId: string) {
  const companyStatus = await getCompanySyncStatus(ctx, companyId);
  return companyStatus.latestMigrationPreview;
}

export async function loadMigrationJobStatusData(ctx: PluginContext, companyId: string): Promise<MigrationJobStatusData> {
  return {
    companyId,
    checkpoint: await getCompanyCheckpoint(ctx, companyId),
  };
}

export async function probePromptContext(
  ctx: PluginContext,
  companyId: string,
  input?: { issueId?: string | null; agentId?: string | null; prompt?: string | null },
) {
  const issueId = input?.issueId ?? (await listCompanyIssues(ctx, companyId))[0]?.id ?? null;
  const agentId = input?.agentId ?? (await listCompanyAgents(ctx, companyId))[0]?.id ?? null;
  if (!agentId) {
    await patchCompanySyncStatus(ctx, companyId, {
      promptContextStatus: "inactive",
    });
    return { status: "inactive" as const, preview: null };
  }

  try {
    const result = await buildPromptContext(ctx, {
      companyId,
      issueId,
      agentId,
      runId: `probe:${companyId}:${issueId ?? "workspace"}:${agentId}`,
      prompt: input?.prompt ?? undefined,
    });
    await patchCompanySyncStatus(ctx, companyId, {
      promptContextStatus: result ? "active" : "inactive",
      lastError: null,
    });
    return {
      status: result ? "active" as const : "inactive" as const,
      preview: result?.preview ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const previous = await getCompanySyncStatus(ctx, companyId);
    await patchCompanySyncStatus(ctx, companyId, {
      promptContextStatus: "degraded",
      lastError: buildSyncErrorSummary({ message }),
      pendingFailureCount: previous.pendingFailureCount + 1,
    });
    throw error;
  }
}

export async function repairMappings(
  ctx: PluginContext,
  companyId: string,
  deadline?: number,
  run: InitializationRun = newInitializationRun(""),
): Promise<RepairMappingsResult> {
  const config = await getResolvedConfig(ctx, companyId);
  const company = await ctx.companies.get(companyId);
  const client = await createHonchoClient({ ctx, config });
  let repaired = 0;

  // Ensure a workspace mapping exists. If one is already recorded, its
  // workspaceId is canonical and is left untouched — Honcho workspace/peer/
  // session ids must stay stable across renames and plugin upgrades, or a
  // company's accumulated memory (representations, conclusions, dreams)
  // becomes unreachable the next time this runs.
  await upsertWorkspaceMapping(ctx, company, companyId, config.workspacePrefix);

  const workspaceId = await client.ensureCompanyWorkspace(companyId, company);
  repaired += 1;

  // Runs right after the workspace mapping, before the per-agent/per-issue
  // loops below: those loops can throw on a single already-mapped row (a
  // host-side upsert quirk on existing rows, unrelated to this plugin) and
  // abort the rest of this function, which must never take the independent
  // MCP bridge sync down with it. Best-effort: only runs when an operator
  // has opted in via agentRuntimeHomePathTemplate.
  const bridgeResult = await syncAgentRuntimeMcpBridge(companyId, config).catch(
    (error): McpBridgeSyncResult => ({
      status: "failed",
      message: error instanceof Error ? error.message : String(error),
    }),
  );
  if (bridgeResult.status === "failed") {
    ctx.logger.warn("Honcho MCP bridge sync failed", { companyId, error: bridgeResult.message });
  }

  // A mapping is written only after Honcho accepted the peer or session, so
  // mapped agents and issues are skipped. The run records how far earlier
  // calls got, so each agent and issue is checked once per initialization.
  const agents = run.agents ??= await listCompanyAgents(ctx, companyId);
  while (run.agentsChecked < agents.length) {
    const agent = agents[run.agentsChecked]!;
    if ((await getAgentPeerMappingRecord(ctx, companyId, agent.id))?.status !== "mapped") {
      await client.ensureAgentPeer(companyId, agent);
      await upsertAgentPeerMapping(ctx, companyId, agent);
      repaired += 1;
    }
    run.agentsChecked += 1;
    if (pastDeadline(deadline)) return { repaired, done: false };
  }

  const issues = run.issues ??= await listCompanyIssues(ctx, companyId);
  while (run.issuesChecked < issues.length) {
    const issue = issues[run.issuesChecked]!;
    if ((await getSessionMappingRecord(ctx, issue.id))?.status !== "mapped") {
      await client.ensureIssueSession(issue, company);
      await upsertSessionMapping(ctx, issue, workspaceId);
      repaired += 1;
    }
    run.issuesChecked += 1;
    if (pastDeadline(deadline)) return { repaired, done: false };
  }

  await patchCompanySyncStatus(ctx, companyId, {
    workspaceStatus: "mapped",
    peerStatus: agents.length > 0 ? "complete" : "partial",
    lastError: null,
  });

  return { repaired, done: true };
}

export async function getIssueContext(ctx: PluginContext, issueId: string, companyId: string) {
  const issue = await ctx.issues.get(issueId, companyId);
  if (!issue) throw new Error("Issue not found");
  const company = await ctx.companies.get(companyId);
  const config = await getResolvedConfig(ctx, companyId);
  const context = await refreshContextPreview(ctx, issue, company, config);
  return {
    ...context,
    issueIdentifier: issue.identifier ?? null,
  };
}

export async function getSessionContext(ctx: PluginContext, issueId: string, companyId: string) {
  return await getIssueContext(ctx, issueId, companyId);
}

export async function getWorkspaceContext(
  ctx: PluginContext,
  agentId: string,
  companyId: string,
  query: string,
): Promise<HonchoSearchResult[]> {
  const config = await getResolvedConfig(ctx, companyId);
  const client = await createHonchoClient({ ctx, config });
  return await client.getWorkspaceContext(companyId, agentId, query);
}

export async function getAgentContext(
  ctx: PluginContext,
  companyId: string,
  agentId: string,
  issueId?: string | null,
) {
  const config = await getResolvedConfig(ctx, companyId);
  const client = await createHonchoClient({ ctx, config });
  return await client.getPeerRepresentation(companyId, agentId, {
    issueId: issueId ?? null,
  });
}

export async function getHierarchyContext(
  _ctx: PluginContext,
  _companyId: string,
  _runId: string,
): Promise<string | null> {
  return null;
}

export async function searchMemory(
  ctx: PluginContext,
  agentId: string,
  companyId: string,
  params: SearchMemoryParams,
) {
  const config = await getResolvedConfig(ctx, companyId);
  const client = await createHonchoClient({ ctx, config });
  const scope = params.scope ?? (params.issueId ? "session" : "workspace");
  return await client.searchMemory(companyId, agentId, {
    ...params,
    scope,
    limit: params.limit ?? DEFAULT_SEARCH_LIMIT,
  });
}

export async function buildPromptContext(
  ctx: PluginContext,
  input: PromptContextBuildInput,
): Promise<PromptContextBuildResult | null> {
  const config = await getResolvedConfig(ctx, input.companyId);
  if (!config.enablePromptContext) return null;
  if (!validateConfig(config).ok) return null;

  const client = await createHonchoClient({ ctx, config });
  const [company, issue, agent] = await Promise.all([
    ctx.companies.get(input.companyId),
    input.issueId ? ctx.issues.get(input.issueId, input.companyId) : Promise.resolve(null),
    ctx.agents.get(input.agentId, input.companyId),
  ]);

  if (agent) {
    await client.ensureAgentPeer(input.companyId, agent);
  }

  const query = input.prompt ?? issue?.title ?? company?.name ?? agent?.name ?? "recent company memory";
  const sections: string[] = [];

  if (issue) {
    await syncIssue(ctx, issue.id, input.companyId, { replay: false });
    const issueContext = await getIssueContext(ctx, issue.id, input.companyId);
    if (issueContext.preview) {
      sections.push(`Task session memory for ${issue.identifier ?? issue.id}:\n${issueContext.preview}`);
    }
  }

  const peerRepresentation = await client.getPeerRepresentation(input.companyId, input.agentId, {
    issueId: issue?.id ?? null,
  }).catch(() => null);
  if (peerRepresentation) {
    sections.push(`Active employee peer memory:\n${peerRepresentation}`);
  }

  const workspaceResults = await searchMemory(ctx, input.agentId, input.companyId, {
    query,
    scope: "workspace",
    limit: 3,
  }).catch(() => []);
  const workspacePreview = formatSearchResults(workspaceResults);
  if (workspacePreview) {
    sections.push(`Company workspace recall:\n${workspacePreview}`);
  }

  const hierarchyPreview = await getHierarchyContext(ctx, input.companyId, input.runId).catch(() => null);
  if (hierarchyPreview) {
    sections.push(`Delegated child memory:\n${hierarchyPreview}`);
    if (issue) {
      await patchIssueSyncStatus(ctx, issue.id, {
        latestHierarchyContextPreview: hierarchyPreview,
      });
    }
  }

  if (sections.length === 0) return null;

  const prompt = sections.join("\n\n");
  const preview = prompt.length > 1500 ? `${prompt.slice(0, 1500)}...` : prompt;

  if (issue) {
    await patchIssueSyncStatus(ctx, issue.id, {
      latestPromptContextPreview: preview,
      latestPromptContextBuiltAt: new Date().toISOString(),
    });
  }

  return {
    prompt,
    preview,
    metadata: {
      companyId: input.companyId,
      issueId: issue?.id ?? null,
      agentId: input.agentId,
    },
  };
}
