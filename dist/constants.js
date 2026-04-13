// src/constants.ts
var PLUGIN_ID = "honcho-ai.paperclip-honcho";
var PLUGIN_VERSION = "0.1.2";
var STATE_NAMESPACE = "honcho";
var DEFAULT_WORKSPACE_PREFIX = "paperclip";
var HONCHO_V3_PATH = "/v3";
var HONCHO_CONNECTION_PROBE_PATH = `${HONCHO_V3_PATH}/workspaces`;
var DEFAULT_CONTEXT_SUMMARY_LIMIT = 3;
var DEFAULT_CONTEXT_TOKEN_LIMIT = 2e3;
var DEFAULT_SEARCH_LIMIT = 5;
var DEFAULT_MAX_INGEST_MESSAGE_CHARS = 2e3;
var DEFAULT_DOCUMENT_SECTION_SIZE = 1800;
var DEFAULT_DOCUMENT_SECTION_OVERLAP = 200;
var DEFAULT_BACKFILL_BATCH_SIZE = 100;
var DEFAULT_MAX_WORKSPACE_FILE_BYTES = 64 * 1024;
var DEFAULT_MIN_IMPORT_TEXT_LENGTH = 12;
var DEFAULT_FILE_SCAN_LIMIT = 100;
var DEFAULT_FILE_SCAN_MAX_DEPTH = 4;
var DEFAULT_SUMMARIZED_SEARCH_LIMIT = 3;
var LEGACY_ROOT_FILES = [
  "USER.md",
  "MEMORY.md",
  "IDENTITY.md",
  "SOUL.md",
  "AGENTS.md",
  "TOOLS.md",
  "BOOTSTRAP.md"
];
var LEGACY_DIRECTORY_ROOTS = [
  "memory",
  "canvas"
];
var FILE_IMPORT_PRIORITY = [
  "USER.md",
  "MEMORY.md",
  "SOUL.md",
  "IDENTITY.md",
  "AGENTS.md",
  "TOOLS.md",
  "memory",
  "canvas"
];
var DEFAULT_NOISE_PATTERNS = [
  "^HEARTBEAT_OK$",
  "^\\[paperclip\\]\\s+starting run$",
  "^\\[paperclip\\]\\s+run started$",
  "^\\[paperclip\\]\\s+session resumed$",
  "^run started$",
  "^run finished$",
  "^startup banner:?$"
];
var SLOT_IDS = {
  settingsPage: "honcho-settings-page",
  issueTab: "honcho-issue-memory-tab"
};
var EXPORT_NAMES = {
  settingsPage: "HonchoSettingsPage",
  issueTab: "HonchoIssueMemoryTab",
  toolbarButton: "HonchoMemoryToolbarLauncher"
};
var DATA_KEYS = {
  memoryStatus: "memory-status",
  migrationPreview: "migration-preview",
  migrationJobStatus: "migration-job-status",
  issueStatus: "issue-memory-status"
};
var ACTION_KEYS = {
  testConnection: "test-connection",
  probePromptContext: "probe-prompt-context",
  resyncIssue: "resync-issue"
};
var JOB_KEYS = {
  initializeMemory: "initialize-memory",
  migrationScan: "migration-scan",
  migrationImport: "migration-import"
};
var TOOL_NAMES = {
  getIssueContext: "honcho_get_issue_context",
  searchMemory: "honcho_search_memory",
  askPeer: "honcho_ask_peer",
  getWorkspaceContext: "honcho_get_workspace_context",
  searchMessages: "honcho_search_messages",
  searchConclusions: "honcho_search_conclusions",
  getSession: "honcho_get_session",
  getAgentContext: "honcho_get_agent_context",
  getHierarchyContext: "honcho_get_hierarchy_context"
};
var ENTITY_TYPES = {
  workspaceMapping: "honcho-workspace-mapping",
  peerMapping: "honcho-peer-mapping",
  sessionMapping: "honcho-session-mapping",
  importLedger: "honcho-import-ledger",
  migrationReport: "honcho-migration-report",
  agentLineage: "honcho-agent-lineage",
  fileImportSource: "honcho-file-import-source",
  runtimeFlushCheckpoint: "honcho-runtime-flush-checkpoint"
};
var RUNTIME_LAUNCHERS = [
  {
    id: "honcho-memory-launcher",
    displayName: "Honcho Memory",
    placementZone: "globalToolbarButton",
    action: {
      type: "openDrawer",
      target: EXPORT_NAMES.toolbarButton
    },
    render: {
      environment: "hostOverlay"
    }
  }
];
var DEFAULT_CONFIG = {
  honchoApiBaseUrl: "https://api.honcho.dev",
  honchoApiKey: "",
  workspacePrefix: DEFAULT_WORKSPACE_PREFIX,
  syncIssueComments: true,
  syncIssueDocuments: true,
  enablePromptContext: false,
  enablePeerChat: true,
  observe_me: true,
  observe_others: true,
  noisePatterns: [],
  disableDefaultNoisePatterns: false,
  stripPlatformMetadata: true,
  flushBeforeReset: false
};
var ISSUE_STATUS_STATE_KEY = "issue-sync-status";
var COMPANY_STATUS_STATE_KEY = "company-memory-status";
var COMPANY_CHECKPOINT_STATE_KEY = "company-memory-checkpoints";
export {
  ACTION_KEYS,
  COMPANY_CHECKPOINT_STATE_KEY,
  COMPANY_STATUS_STATE_KEY,
  DATA_KEYS,
  DEFAULT_BACKFILL_BATCH_SIZE,
  DEFAULT_CONFIG,
  DEFAULT_CONTEXT_SUMMARY_LIMIT,
  DEFAULT_CONTEXT_TOKEN_LIMIT,
  DEFAULT_DOCUMENT_SECTION_OVERLAP,
  DEFAULT_DOCUMENT_SECTION_SIZE,
  DEFAULT_FILE_SCAN_LIMIT,
  DEFAULT_FILE_SCAN_MAX_DEPTH,
  DEFAULT_MAX_INGEST_MESSAGE_CHARS,
  DEFAULT_MAX_WORKSPACE_FILE_BYTES,
  DEFAULT_MIN_IMPORT_TEXT_LENGTH,
  DEFAULT_NOISE_PATTERNS,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SUMMARIZED_SEARCH_LIMIT,
  DEFAULT_WORKSPACE_PREFIX,
  ENTITY_TYPES,
  EXPORT_NAMES,
  FILE_IMPORT_PRIORITY,
  HONCHO_CONNECTION_PROBE_PATH,
  HONCHO_V3_PATH,
  ISSUE_STATUS_STATE_KEY,
  JOB_KEYS,
  LEGACY_DIRECTORY_ROOTS,
  LEGACY_ROOT_FILES,
  PLUGIN_ID,
  PLUGIN_VERSION,
  RUNTIME_LAUNCHERS,
  SLOT_IDS,
  STATE_NAMESPACE,
  TOOL_NAMES
};
//# sourceMappingURL=constants.js.map
