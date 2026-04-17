import type {
  Company,
  Issue,
  IssueComment,
  PluginContext,
  ScopeKey,
  ToolRunContext,
} from "@paperclipai/plugin-sdk";

export type HonchoPluginConfig = {
  honchoApiBaseUrl?: string;
  honchoApiKey?: string;
  honchoApiKeySecretRef?: string;
  workspacePrefix?: string;
  syncIssueComments?: boolean;
  syncIssueDocuments?: boolean;
  enablePromptContext?: boolean;
  enablePeerChat?: boolean;
  observe_me?: boolean;
  observe_others?: boolean;
  observeMe?: boolean;
  observeOthers?: boolean;
  observeAgentPeers?: boolean;
  noisePatterns?: string[];
  disableDefaultNoisePatterns?: boolean;
  stripPlatformMetadata?: boolean;
  flushBeforeReset?: boolean;
};

export type HonchoResolvedConfig = {
  honchoApiBaseUrl: string;
  honchoApiKey: string;
  workspacePrefix: string;
  syncIssueComments: boolean;
  syncIssueDocuments: boolean;
  enablePromptContext: boolean;
  enablePeerChat: boolean;
  observe_me: boolean;
  observe_others: boolean;
  noisePatterns: string[];
  disableDefaultNoisePatterns: boolean;
  stripPlatformMetadata: boolean;
  flushBeforeReset: boolean;
};

export type MigrationSourceType =
  | "issue_comments"
  | "issue_documents"
  | "legacy_memory_files"
  | "workspace_guidance_files"
  | "agent_profile_files";

export type CompanyMemoryConnectionStatus = "not_configured" | "auth_failed" | "connected";
export type CompanyWorkspaceStatus = "unknown" | "mapped" | "created" | "failed";
export type CompanyPeerStatus = "not_started" | "partial" | "complete";
export type CompanyInitializationStatus = "not_started" | "running" | "partial" | "complete" | "failed";
export type CompanyMigrationStatus = "not_started" | "scanned" | "preview_ready" | "running" | "partial" | "complete" | "failed";
export type CompanyPromptContextStatus = "inactive" | "active" | "degraded";

export type HonchoActor =
  | { authorType: "agent"; authorId: string }
  | { authorType: "user"; authorId: string }
  | { authorType: "system"; authorId: string };

export type IssueSyncStatus = {
  lastSyncedCommentId: string | null;
  lastSyncedCommentCreatedAt: string | null;
  lastSyncedDocumentRevisionKey: string | null;
  lastSyncedDocumentRevisionId: string | null;
  lastSyncedRunId: string | null;
  lastSyncedRunFinishedAt: string | null;
  lastBackfillAt: string | null;
  replayRequestedAt: string | null;
  replayInProgress: boolean;
  lastError: SyncErrorSummary | null;
  latestContextPreview: string | null;
  latestContextFetchedAt: string | null;
  latestAppendAt: string | null;
  latestPromptContextPreview: string | null;
  latestPromptContextBuiltAt: string | null;
  latestHierarchyContextPreview?: string | null;
};

export type InitializationReport = {
  companyId: string;
  workspace: {
    id: string | null;
    status: "created" | "existing" | "failed" | "skipped";
  };
  peers: {
    mapped: number;
    status: CompanyPeerStatus;
  };
  importSummary: {
    comments: number;
    documents: number;
    skipped: number;
    failed: number;
  };
  promptContext: {
    status: CompanyPromptContextStatus;
    preview: string | null;
  };
  completedAt: string;
};

export type MigrationPreview = {
  companyId: string;
  sourceTypes: MigrationSourceType[];
  totals: {
    comments: number;
    documents: number;
    files: number;
  };
  issues: Array<{
    issueId: string;
    issueIdentifier: string | null;
    issueTitle: string | null;
    commentCount: number;
    documentCount: number;
    estimatedMessages: number;
  }>;
  estimatedMessages: number;
  warnings: string[];
  generatedAt: string;
};

export type MigrationImportSummary = {
  commentsImported: number;
  documentsImported: number;
  skipped: number;
  failed: number;
};

export type CompanyMemoryStatus = {
  connectionStatus: CompanyMemoryConnectionStatus;
  workspaceStatus: CompanyWorkspaceStatus;
  peerStatus: CompanyPeerStatus;
  initializationStatus: CompanyInitializationStatus;
  migrationStatus: CompanyMigrationStatus;
  promptContextStatus: CompanyPromptContextStatus;
  lastSuccessfulSyncAt: string | null;
  lastError: SyncErrorSummary | null;
  pendingFailureCount: number;
  lastInitializationReport: InitializationReport | null;
  latestMigrationPreview: MigrationPreview | null;
};

export type CompanyMemoryCheckpoint = {
  activeJobKey: string | null;
  status: "idle" | "running" | "failed" | "complete";
  processed: number;
  succeeded: number;
  skipped: number;
  failed: number;
  currentSourceType: MigrationSourceType | null;
  currentEntityId: string | null;
  lastError: string | null;
  updatedAt: string | null;
};

export type SyncErrorSummary = {
  at: string;
  message: string;
  code?: string | null;
  issueId?: string | null;
  commentId?: string | null;
  documentKey?: string | null;
};

export type HonchoProvenance = {
  sourceSystem: "paperclip";
  companyId: string;
  issueId: string;
  runId: string | null;
  commentId: string | null;
  documentRevisionId: string | null;
  authorType: "agent" | "user" | "system";
  authorId: string;
  paperclipEntityUrl: string;
  paperclipIssueIdentifier: string | null;
  ingestedAt: string;
  contentType: "issue_comment" | "issue_document_section" | "run_transcript_chunk" | "legacy_memory_file" | "workspace_guidance_file" | "agent_profile_file";
};

export type HonchoMessageInput = {
  content: string;
  peerId: string;
  createdAt: string;
  metadata: HonchoProvenance & Record<string, unknown>;
};

export type HonchoSessionSummary = {
  summary?: string | null;
  content?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type HonchoContextMessage = {
  role?: string | null;
  content?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type HonchoContextSummary = {
  content?: string | null;
  message_id?: string | null;
  summary_type?: string | null;
  created_at?: string | null;
  token_count?: number | null;
};

export type HonchoSessionContextResult = {
  summary?: HonchoContextSummary | string | null;
  content?: string | null;
  context?: string | null;
  messages?: HonchoContextMessage[] | null;
  metadata?: Record<string, unknown> | null;
};

export type HonchoSearchResult = {
  id?: string | null;
  content?: string | null;
  metadata?: Record<string, unknown> | null;
  score?: number | null;
};

export type HonchoRepresentationResult = {
  representation?: string | null;
  metadata?: Record<string, unknown> | null;
  summary?: string | null;
  content?: string | null;
  results?: HonchoSearchResult[] | null;
};

export type HonchoChatResult = {
  text?: string | null;
  response?: string | null;
  messages?: Array<{ role?: string | null; content?: string | null }>;
  metadata?: Record<string, unknown> | null;
};

export type HonchoClientInput = {
  ctx: PluginContext;
  config: HonchoResolvedConfig;
};

export type HonchoSearchScope = "workspace" | "session";

export type SearchMemoryParams = {
  query: string;
  issueId?: string;
  scope?: HonchoSearchScope;
  limit?: number;
  summaryOnly?: boolean;
};

export type AskPeerParams = {
  targetPeerId: string;
  query: string;
  issueId?: string;
};

export type HonchoIssueContext = {
  issueId: string;
  issueIdentifier: string | null;
  sessionId: string;
  workspaceId: string;
  summaries: HonchoSessionSummary[];
  context: HonchoSessionContextResult | null;
  preview: string | null;
};

export type IssueMemoryStatusData = {
  syncEnabled: boolean;
  issueId: string;
  issueIdentifier: string | null;
  lastSyncedCommentId: string | null;
  lastSyncedCommentCreatedAt: string | null;
  lastSyncedDocumentRevisionKey: string | null;
  lastSyncedDocumentRevisionId: string | null;
  lastSyncedRunId: string | null;
  lastSyncedRunFinishedAt: string | null;
  lastBackfillAt: string | null;
  replayRequestedAt: string | null;
  replayInProgress: boolean;
  lastError: SyncErrorSummary | null;
  contextPreview: string | null;
  contextFetchedAt: string | null;
  latestAppendAt: string | null;
  latestPromptContextPreview: string | null;
  latestPromptContextBuiltAt: string | null;
  config: {
    syncIssueComments: boolean;
    syncIssueDocuments: boolean;
    enablePromptContext: boolean;
    enablePeerChat: boolean;
    observe_me: boolean;
    observe_others: boolean;
  };
};

export type SetupChecklistItem = {
  key: string;
  label: string;
  done: boolean;
  detail: string;
};

export type MemoryStatusData = {
  config: {
    honchoApiBaseUrl: string;
    honchoApiKey: string;
    workspacePrefix: string;
    syncIssueComments: boolean;
    syncIssueDocuments: boolean;
    enablePromptContext: boolean;
    enablePeerChat: boolean;
    observe_me: boolean;
    observe_others: boolean;
  };
  validation: {
    ok: boolean;
    warnings: string[];
    errors: string[];
  };
  companyId: string | null;
  companyStatus: CompanyMemoryStatus | null;
  counts: {
    mappedPeers: number;
    mappedSessions: number;
    importedComments: number;
    importedDocuments: number;
    importedRuns: number;
    importedFiles: number;
  };
  checkpoints: CompanyMemoryCheckpoint | null;
  jobs: Array<{
    id: string;
    jobKey: string;
    displayName: string;
    status: string;
  }>;
};

export type MigrationJobStatusData = {
  companyId: string;
  checkpoint: CompanyMemoryCheckpoint | null;
};

export type WorkspaceFileCandidate = {
  workspaceId: string;
  projectId: string;
  path: string;
  sizeBytes: number | null;
  modifiedAt: string | null;
};

export type LegacyFileCategory = "legacy-user-memory" | "workspace-guidance" | "agent-profile";

export type MigrationSourceCandidate = {
  sourceType: MigrationSourceType;
  issueId: string | null;
  issueIdentifier: string | null;
  sourceId: string;
  fingerprint: string;
  authorType: HonchoActor["authorType"];
  authorId: string;
  createdAt: string;
  content: string;
  title: string;
  metadata: Record<string, unknown>;
  workspaceId?: string | null;
  projectId?: string | null;
  sourceCategory?: LegacyFileCategory | null;
};

export type LineageRecord = {
  companyId: string;
  parentAgentId: string;
  childAgentId: string;
  parentPeerId: string;
  childPeerId: string;
  parentRunId: string;
  childRunId: string;
  parentIssueId: string | null;
  childIssueId: string | null;
  delegationDepth: number;
  spawnedAt: string;
};

export type NormalizedMessage = {
  content: string;
  fingerprint: string;
};

export type WorkerActionParams = Record<string, unknown>;

export type IssueDocumentRef = {
  id?: string;
  key: string;
  title: string | null;
  body?: string;
  latestRevisionId?: string | null;
  latestRevisionNumber?: number | null;
  updatedAt?: string | Date;
  updatedByAgentId?: string | null;
  updatedByUserId?: string | null;
  createdByAgentId?: string | null;
  createdByUserId?: string | null;
};

export type DocumentRevision = {
  id: string;
  companyId?: string;
  documentId: string;
  issueId: string;
  key: string;
  revisionNumber: number;
  body: string;
  changeSummary?: string | null;
  createdByAgentId?: string | null;
  createdByUserId?: string | null;
  createdAt: string | Date;
};

export type IssueDocumentBundle = {
  document: IssueDocumentRef;
  revisions: DocumentRevision[];
};

export type SyncIssueOptions = {
  replay?: boolean;
  commentIdHint?: string | null;
  documentKeyHint?: string | null;
  runIdHint?: string | null;
};

export type SyncIssueResult = {
  issueId: string;
  issueIdentifier: string | null;
  syncedComments: number;
  syncedDocumentSections: number;
  syncedRuns: number;
  lastSyncedCommentId: string | null;
  lastSyncedRunId: string | null;
  replayed: boolean;
};

export type RepairMappingsResult = {
  repaired: number;
};

export type ScopedStateInput = ScopeKey;

export type HonchoToolRunContext = ToolRunContext & {
  issueId?: string | null;
};

export type SyncableIssueResource = {
  issue: Issue;
  company: Company | null;
  comments: IssueComment[];
  documents: IssueDocumentBundle[];
};

export type PromptContextBuildInput = {
  companyId: string;
  issueId?: string | null;
  agentId: string;
  runId: string;
  prompt?: string;
};

export type PromptContextBuildResult = {
  prompt: string;
  preview?: string | null;
  metadata?: Record<string, unknown>;
};
