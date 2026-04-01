import type { PluginLauncherRegistration } from "@paperclipai/plugin-sdk";

export const PLUGIN_ID = "honcho-ai.paperclip-honcho";
export const PLUGIN_VERSION = "0.1.0";
export const STATE_NAMESPACE = "honcho";
export const DEFAULT_WORKSPACE_PREFIX = "paperclip";
export const HONCHO_V3_PATH = "/v3";
export const HONCHO_CONNECTION_PROBE_PATH = `${HONCHO_V3_PATH}/workspaces`;
export const DEFAULT_CONTEXT_SUMMARY_LIMIT = 3;
export const DEFAULT_CONTEXT_TOKEN_LIMIT = 2000;
export const DEFAULT_SEARCH_LIMIT = 5;
export const DEFAULT_MAX_INGEST_MESSAGE_CHARS = 2000;
export const DEFAULT_DOCUMENT_SECTION_SIZE = 1800;
export const DEFAULT_DOCUMENT_SECTION_OVERLAP = 200;
export const DEFAULT_BACKFILL_BATCH_SIZE = 100;
export const DEFAULT_MAX_WORKSPACE_FILE_BYTES = 64 * 1024;
export const DEFAULT_MIN_IMPORT_TEXT_LENGTH = 12;
export const DEFAULT_FILE_SCAN_LIMIT = 100;
export const DEFAULT_FILE_SCAN_MAX_DEPTH = 4;
export const DEFAULT_SUMMARIZED_SEARCH_LIMIT = 3;

export const LEGACY_ROOT_FILES = [
  "USER.md",
  "MEMORY.md",
  "IDENTITY.md",
  "SOUL.md",
  "AGENTS.md",
  "TOOLS.md",
  "BOOTSTRAP.md",
] as const;

export const LEGACY_DIRECTORY_ROOTS = [
  "memory",
  "canvas",
] as const;

export const FILE_IMPORT_PRIORITY = [
  "USER.md",
  "MEMORY.md",
  "SOUL.md",
  "IDENTITY.md",
  "AGENTS.md",
  "TOOLS.md",
  "memory",
  "canvas",
] as const;

export const DEFAULT_NOISE_PATTERNS = [
  "^HEARTBEAT_OK$",
  "^\\[paperclip\\]\\s+starting run$",
  "^\\[paperclip\\]\\s+run started$",
  "^\\[paperclip\\]\\s+session resumed$",
  "^run started$",
  "^run finished$",
  "^startup banner:?$",
] as const;

export const SLOT_IDS = {
  settingsPage: "honcho-settings-page",
  issueTab: "honcho-issue-memory-tab",
} as const;

export const EXPORT_NAMES = {
  settingsPage: "HonchoSettingsPage",
  issueTab: "HonchoIssueMemoryTab",
  toolbarButton: "HonchoMemoryToolbarLauncher",
} as const;

export const DATA_KEYS = {
  memoryStatus: "memory-status",
  migrationPreview: "migration-preview",
  migrationJobStatus: "migration-job-status",
  issueStatus: "issue-memory-status",
} as const;

export const ACTION_KEYS = {
  testConnection: "test-connection",
  probePromptContext: "probe-prompt-context",
  repairMappings: "repair-mappings",
  resyncIssue: "resync-issue",
} as const;

export const JOB_KEYS = {
  initializeMemory: "initialize-memory",
  migrationScan: "migration-scan",
  migrationImport: "migration-import",
} as const;

export const TOOL_NAMES = {
  getIssueContext: "honcho_get_issue_context",
  searchMemory: "honcho_search_memory",
  askPeer: "honcho_ask_peer",
  getWorkspaceContext: "honcho_get_workspace_context",
  searchMessages: "honcho_search_messages",
  searchConclusions: "honcho_search_conclusions",
  getSession: "honcho_get_session",
  getAgentContext: "honcho_get_agent_context",
  getHierarchyContext: "honcho_get_hierarchy_context",
} as const;

export const ENTITY_TYPES = {
  workspaceMapping: "honcho-workspace-mapping",
  peerMapping: "honcho-peer-mapping",
  sessionMapping: "honcho-session-mapping",
  importLedger: "honcho-import-ledger",
  migrationReport: "honcho-migration-report",
  agentLineage: "honcho-agent-lineage",
  fileImportSource: "honcho-file-import-source",
  runtimeFlushCheckpoint: "honcho-runtime-flush-checkpoint",
} as const;

export const RUNTIME_LAUNCHERS: PluginLauncherRegistration[] = [
  {
    id: "honcho-memory-launcher",
    displayName: "Honcho Memory",
    placementZone: "globalToolbarButton",
    action: {
      type: "openDrawer",
      target: EXPORT_NAMES.toolbarButton,
    },
    render: {
      environment: "hostOverlay",
    },
  },
];

export const DEFAULT_CONFIG = {
  honchoApiBaseUrl: "https://api.honcho.dev",
  honchoApiKeySecretRef: "",
  workspacePrefix: DEFAULT_WORKSPACE_PREFIX,
  syncIssueComments: true,
  syncIssueDocuments: true,
  enablePromptContext: false,
  enablePeerChat: true,
  observeAgentPeers: false,
  noisePatterns: [] as string[],
  disableDefaultNoisePatterns: false,
  stripPlatformMetadata: true,
  flushBeforeReset: false,
} as const;

export const ISSUE_STATUS_STATE_KEY = "issue-sync-status";
export const COMPANY_STATUS_STATE_KEY = "company-memory-status";
export const COMPANY_CHECKPOINT_STATE_KEY = "company-memory-checkpoints";
