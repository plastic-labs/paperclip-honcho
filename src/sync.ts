import type {
  Company,
  Issue,
  IssueComment,
  PluginContext,
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
import {
  buildMigrationReportPayload,
  ensureActorPeerMapping,
  getImportLedgerRecord,
  listJobsForUi,
  listMappingCounts,
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
  LineageRecord,
  NormalizedMessage,
  HonchoMessageInput,
  HonchoResolvedConfig,
  IssueDocumentBundle,
  InitializationReport,
  LegacyFileCategory,
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

async function resolvePeerIdFromActor(
  ctx: PluginContext,
  companyId: string,
  actor: HonchoActor,
): Promise<string> {
  if (actor.authorType === "agent") {
    const agent = await ctx.agents.get(actor.authorId, companyId);
    return peerIdForAgent(actor.authorId, agent?.name ?? null);
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

async function buildDocumentMessages(
  ctx: PluginContext,
  issue: Issue,
  documents: IssueDocumentBundle[],
  config: HonchoResolvedConfig,
  lastSyncedRevisionId: string | null,
): Promise<HonchoMessageInput[]> {
  const messages: HonchoMessageInput[] = [];
  let unlocked = lastSyncedRevisionId == null;

  for (const bundle of documents) {
    for (const revision of bundle.revisions) {
      if (!unlocked) {
        if (revision.id === lastSyncedRevisionId) {
          unlocked = true;
        }
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

async function listCompanyIssues(ctx: PluginContext, companyId: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  let offset = 0;
  while (true) {
    const batch = await ctx.issues.list({
      companyId,
      limit: DEFAULT_BACKFILL_BATCH_SIZE,
      offset,
    });
    if (batch.length === 0) break;
    issues.push(...batch);
    offset += batch.length;
  }
  return issues;
}

async function listCompanyAgents(ctx: PluginContext, companyId: string) {
  return await ctx.agents.list({
    companyId,
    limit: DEFAULT_BACKFILL_BATCH_SIZE,
    offset: 0,
  });
}

async function buildMigrationCandidates(
  ctx: PluginContext,
  companyId: string,
): Promise<MigrationSourceCandidate[]> {
  const config = await getResolvedConfig(ctx);
  const issues = await listCompanyIssues(ctx, companyId);
  const candidates: MigrationSourceCandidate[] = [];

  for (const issue of issues) {
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
  }

  return candidates.sort((left, right) => {
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
}

async function loadMigrationCandidates(
  ctx: PluginContext,
  companyId: string,
): Promise<MigrationSourceCandidate[]> {
  const candidates = migrationCandidatesLoaderOverride
    ? await migrationCandidatesLoaderOverride(ctx, companyId)
    : await buildMigrationCandidates(ctx, companyId);
  return await filterAlreadySyncedMigrationCandidates(ctx, candidates);
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
  const config = await getResolvedConfig(ctx);
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
  const existing = await getImportLedgerRecord(ctx, companyId, externalId);
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
      await upsertImportLedger(ctx, companyId, {
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

    await upsertImportLedger(ctx, companyId, {
      sourceType: candidate.sourceType === "issue_comments" ? "issue_comment" : candidate.sourceType === "issue_documents" ? "issue_document" : "run_transcript",
      externalId,
      fingerprint: candidate.fingerprint,
      issueId: candidate.issueId,
      issueIdentifier: candidate.issueIdentifier,
      importedAt: new Date().toISOString(),
      metadata: candidate.metadata,
    });
    if (candidateProvenanceKey) {
      existingSessionProvenance.add(candidateProvenanceKey);
    }
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
        ? peerIdForAgent(agentProfile.id, agentProfile.name)
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

export async function scanMigrationSources(ctx: PluginContext, companyId: string): Promise<MigrationPreview> {
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
    const preview = buildMigrationPreview(companyId, await loadMigrationCandidates(ctx, companyId));
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

export async function importMigrationPreview(ctx: PluginContext, companyId: string) {
  const config = await getResolvedConfig(ctx);
  const validation = validateConfig(config);
  if (!validation.ok) {
    throw new Error(validation.errors?.join("; ") ?? "Honcho config is invalid");
  }
  const preview = (await getCompanySyncStatus(ctx, companyId)).latestMigrationPreview ?? await scanMigrationSources(ctx, companyId);
  const candidates = await loadMigrationCandidates(ctx, companyId);
  const client = await createHonchoClient({ ctx, config });
  const sessionProvenanceCache = new Map<string, Set<string>>();
  let processed = 0;
  let succeeded = 0;
  let skipped = 0;
  let failed = 0;
  let firstError: string | null = null;

  await patchCompanySyncStatus(ctx, companyId, {
    migrationStatus: "running",
    lastError: null,
  });
  await patchJobProgress(ctx, companyId, {
    activeJobKey: "migration-import",
    status: "running",
    processed: 0,
    succeeded: 0,
    skipped: 0,
    failed: 0,
    currentSourceType: null,
    currentEntityId: null,
    lastError: null,
  });

  for (const candidate of candidates) {
    processed += 1;
    await patchJobProgress(ctx, companyId, {
      activeJobKey: "migration-import",
      processed,
      succeeded,
      skipped,
      failed,
      currentSourceType: candidate.sourceType,
      currentEntityId: candidate.sourceId,
    });
    try {
      const result = await ensureMigrationCandidateImported(ctx, companyId, candidate, config, client, sessionProvenanceCache);
      if (result.imported) {
        succeeded += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      failed += 1;
      firstError ??= error instanceof Error ? error.message : String(error);
    }
  }

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

export async function initializeMemory(ctx: PluginContext, companyId: string): Promise<InitializationReport> {
  const config = await getResolvedConfig(ctx);
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
    await client.probeConnection(companyId, company);
    await repairMappings(ctx, companyId);
    const workspaceId = await client.ensureCompanyWorkspace(companyId, company);

    const preview = await scanMigrationSources(ctx, companyId);
    const countsBefore = await listMappingCounts(ctx, companyId);
    await importMigrationPreview(ctx, companyId);
    const probe = await probePromptContext(ctx, companyId);

    const counts = await listMappingCounts(ctx, companyId);
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
        skipped: 0,
        failed: 0,
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
      migrationStatus: "complete",
      promptContextStatus: probe.status,
      lastSuccessfulSyncAt: new Date().toISOString(),
      lastError: null,
      pendingFailureCount: 0,
      lastInitializationReport: report,
    });
    await patchJobProgress(ctx, companyId, {
      activeJobKey: "initialize-memory",
      status: "complete",
      processed: counts.importedComments + counts.importedDocuments,
      succeeded: counts.importedComments + counts.importedDocuments,
      skipped: 0,
      failed: 0,
      currentSourceType: null,
      currentEntityId: null,
      lastError: null,
    });
    return report;
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
    const config = await getResolvedConfig(ctx);
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
        ? await buildDocumentMessages(ctx, resources.issue, resources.documents, config, replay ? null : status.lastSyncedDocumentRevisionId)
        : [];
      const allMessages = [...commentMessages, ...documentMessages];
      if (allMessages.length > 0) {
        await client.appendMessages(resources.issue.companyId, resources.issue.id, allMessages);
      } else {
        await client.ensureIssueSession(resources.issue, resources.company);
      }

      const lastComment = resources.comments.at(-1) ?? null;
      const lastDocumentRevision = resources.documents.flatMap((bundle) => bundle.revisions).sort(compareRevisions).at(-1) ?? null;
      const context = await refreshContextPreview(ctx, resources.issue, resources.company, config, client);
      await patchIssueSyncStatus(ctx, issueId, {
        lastSyncedCommentId: lastComment?.id ?? status.lastSyncedCommentId,
        lastSyncedCommentCreatedAt: lastComment ? new Date(lastComment.createdAt).toISOString() : status.lastSyncedCommentCreatedAt,
        lastSyncedDocumentRevisionKey: lastDocumentRevision?.key ?? status.lastSyncedDocumentRevisionKey,
        lastSyncedDocumentRevisionId: lastDocumentRevision?.id ?? status.lastSyncedDocumentRevisionId,
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

export async function backfillCompany(
  ctx: PluginContext,
  companyId: string,
): Promise<{ companyId: string; processedIssues: number }> {
  const report = await initializeMemory(ctx, companyId);
  return {
    companyId,
    processedIssues: report.importSummary.comments + report.importSummary.documents,
  };
}

export async function loadIssueStatusData(ctx: PluginContext, issueId: string, companyId: string) {
  const config = await getResolvedConfig(ctx);
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

export async function repairMappings(ctx: PluginContext, companyId: string): Promise<RepairMappingsResult> {
  const config = await getResolvedConfig(ctx);
  const company = await ctx.companies.get(companyId);
  const client = await createHonchoClient({ ctx, config });
  let repaired = 0;

  const workspaceId = await client.ensureCompanyWorkspace(companyId, company);
  await upsertWorkspaceMapping(ctx, company, companyId, config.workspacePrefix, "mapped", workspaceId);
  repaired += 1;

  const agents = await listCompanyAgents(ctx, companyId);
  for (const agent of agents) {
    await client.ensureAgentPeer(companyId, agent);
    await upsertAgentPeerMapping(ctx, companyId, agent);
    repaired += 1;
  }

  const issues = await listCompanyIssues(ctx, companyId);
  for (const issue of issues) {
    await client.ensureIssueSession(issue, company);
    await upsertSessionMapping(ctx, issue, workspaceId);
    repaired += 1;
  }

  await patchCompanySyncStatus(ctx, companyId, {
    workspaceStatus: "mapped",
    peerStatus: agents.length > 0 ? "complete" : "partial",
    lastError: null,
  });

  return { repaired };
}

export async function getIssueContext(ctx: PluginContext, issueId: string, companyId: string) {
  const issue = await ctx.issues.get(issueId, companyId);
  if (!issue) throw new Error("Issue not found");
  const company = await ctx.companies.get(companyId);
  const config = await getResolvedConfig(ctx);
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
  const config = await getResolvedConfig(ctx);
  const client = await createHonchoClient({ ctx, config });
  return await client.getWorkspaceContext(companyId, agentId, query);
}

export async function getAgentContext(
  ctx: PluginContext,
  companyId: string,
  agentId: string,
  issueId?: string | null,
) {
  const config = await getResolvedConfig(ctx);
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
  const config = await getResolvedConfig(ctx);
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
  const config = await getResolvedConfig(ctx);
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
