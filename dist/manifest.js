// src/constants.ts
var DEFAULT_WORKSPACE_PREFIX = "paperclip";
var HONCHO_V3_PATH = "/v3";
var HONCHO_CONNECTION_PROBE_PATH = `${HONCHO_V3_PATH}/workspaces`;
var DEFAULT_MAX_WORKSPACE_FILE_BYTES = 64 * 1024;
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
  repairMappings: "repair-mappings",
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
  honchoApiKeySecretRef: "",
  workspacePrefix: DEFAULT_WORKSPACE_PREFIX,
  syncIssueComments: true,
  syncIssueDocuments: true,
  enablePromptContext: false,
  enablePeerChat: true,
  observeAgentPeers: false,
  noisePatterns: [],
  disableDefaultNoisePatterns: false,
  stripPlatformMetadata: true,
  flushBeforeReset: false
};

// src/manifest.ts
var PLUGIN_ID = "honcho-ai.paperclip-honcho";
var PLUGIN_VERSION = "0.1.0";
var manifest = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Honcho Memory",
  description: "Tool-first Honcho memory integration for Paperclip companies, agents, issues, comments, and documents.",
  author: "Honcho AI",
  categories: ["connector", "automation", "ui"],
  capabilities: [
    "companies.read",
    "projects.read",
    "project.workspaces.read",
    "issues.read",
    "issue.comments.read",
    "issue.documents.read",
    "agents.read",
    "plugin.state.read",
    "plugin.state.write",
    "events.subscribe",
    "jobs.schedule",
    "agent.tools.register",
    "http.outbound",
    "secrets.read-ref",
    "instance.settings.register",
    "ui.detailTab.register",
    "ui.action.register"
  ],
  instanceConfigSchema: {
    type: "object",
    properties: {
      honchoApiBaseUrl: {
        type: "string",
        title: "Honcho API Base URL",
        default: DEFAULT_CONFIG.honchoApiBaseUrl
      },
      honchoApiKeySecretRef: {
        type: "string",
        title: "Honcho API Key Secret",
        format: "secret-ref",
        default: DEFAULT_CONFIG.honchoApiKeySecretRef
      },
      workspacePrefix: {
        type: "string",
        title: "Workspace Prefix",
        default: DEFAULT_CONFIG.workspacePrefix
      },
      syncIssueComments: {
        type: "boolean",
        title: "Sync Issue Comments",
        default: DEFAULT_CONFIG.syncIssueComments
      },
      syncIssueDocuments: {
        type: "boolean",
        title: "Sync Issue Documents",
        default: DEFAULT_CONFIG.syncIssueDocuments
      },
      enablePromptContext: {
        type: "boolean",
        title: "Inject Honcho Prompt Context",
        default: DEFAULT_CONFIG.enablePromptContext
      },
      enablePeerChat: {
        type: "boolean",
        title: "Enable Peer Chat Tool",
        default: DEFAULT_CONFIG.enablePeerChat
      },
      observeAgentPeers: {
        type: "boolean",
        title: "Allow Honcho To Observe Agent Peers",
        default: DEFAULT_CONFIG.observeAgentPeers
      },
      noisePatterns: {
        type: "array",
        title: "Custom Noise Patterns",
        items: { type: "string" },
        default: DEFAULT_CONFIG.noisePatterns
      },
      disableDefaultNoisePatterns: {
        type: "boolean",
        title: "Disable Default Noise Patterns",
        default: DEFAULT_CONFIG.disableDefaultNoisePatterns
      },
      stripPlatformMetadata: {
        type: "boolean",
        title: "Strip Platform Metadata",
        default: DEFAULT_CONFIG.stripPlatformMetadata
      },
      flushBeforeReset: {
        type: "boolean",
        title: "Flush Before Reset",
        default: DEFAULT_CONFIG.flushBeforeReset
      }
    }
  },
  entrypoints: {
    worker: "./dist/worker-bootstrap.js",
    ui: "./dist/ui"
  },
  jobs: [
    {
      jobKey: JOB_KEYS.initializeMemory,
      displayName: "Initialize Memory",
      description: "Connects Honcho, creates core mappings, imports baseline issue memory, and verifies manual prompt previews."
    },
    {
      jobKey: JOB_KEYS.migrationScan,
      displayName: "Scan Migration Sources",
      description: "Scans issue comments and issue documents and writes an import preview."
    },
    {
      jobKey: JOB_KEYS.migrationImport,
      displayName: "Import Historical Memory",
      description: "Imports the approved historical Paperclip issue memory preview into Honcho with idempotent ledger checks."
    }
  ],
  tools: [
    {
      name: TOOL_NAMES.getIssueContext,
      displayName: "Honcho Issue Context",
      description: "Retrieve compact Honcho context for the current issue session.",
      parametersSchema: {
        type: "object",
        properties: {
          issueId: { type: "string" }
        }
      }
    },
    {
      name: TOOL_NAMES.searchMemory,
      displayName: "Honcho Search Memory",
      description: "Search Honcho memory within the current workspace, narrowing to the current issue by default.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          issueId: { type: "string" },
          scope: { type: "string", enum: ["workspace", "session"] },
          limit: { type: "number" }
        },
        required: ["query"]
      }
    },
    {
      name: TOOL_NAMES.askPeer,
      displayName: "Honcho Ask Peer",
      description: "Query Honcho peer chat for a target peer. Requires peer chat to be enabled in plugin config.",
      parametersSchema: {
        type: "object",
        properties: {
          targetPeerId: { type: "string" },
          query: { type: "string" },
          issueId: { type: "string" }
        },
        required: ["targetPeerId", "query"]
      }
    },
    {
      name: TOOL_NAMES.getWorkspaceContext,
      displayName: "Honcho Workspace Context",
      description: "Retrieve broad workspace recall from Honcho.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string" }
        }
      }
    },
    {
      name: TOOL_NAMES.searchMessages,
      displayName: "Honcho Search Messages",
      description: "Search raw Honcho messages.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          issueId: { type: "string" },
          limit: { type: "number" }
        },
        required: ["query"]
      }
    },
    {
      name: TOOL_NAMES.searchConclusions,
      displayName: "Honcho Search Conclusions",
      description: "Search high-signal summarized Honcho memory.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          issueId: { type: "string" },
          limit: { type: "number" }
        },
        required: ["query"]
      }
    },
    {
      name: TOOL_NAMES.getSession,
      displayName: "Honcho Session",
      description: "Retrieve issue session context from Honcho.",
      parametersSchema: {
        type: "object",
        properties: {
          issueId: { type: "string" }
        }
      }
    },
    {
      name: TOOL_NAMES.getAgentContext,
      displayName: "Honcho Agent Context",
      description: "Retrieve peer context for a specific agent.",
      parametersSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          issueId: { type: "string" }
        },
        required: ["agentId"]
      }
    },
    {
      name: TOOL_NAMES.getHierarchyContext,
      displayName: "Honcho Hierarchy Context",
      description: "Retrieve delegated work context when the host provides lineage metadata.",
      parametersSchema: {
        type: "object",
        properties: {
          runId: { type: "string" },
          issueId: { type: "string" }
        }
      }
    }
  ],
  ui: {
    slots: [
      {
        type: "settingsPage",
        id: SLOT_IDS.settingsPage,
        displayName: "Honcho Settings",
        exportName: EXPORT_NAMES.settingsPage
      },
      {
        type: "detailTab",
        id: SLOT_IDS.issueTab,
        displayName: "Memory",
        exportName: EXPORT_NAMES.issueTab,
        entityTypes: ["issue"],
        order: 40
      }
    ],
    launchers: [
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
    ]
  }
};
var HONCHO_DATA_KEYS = DATA_KEYS;
var HONCHO_ACTION_KEYS = ACTION_KEYS;
var HONCHO_JOB_KEYS = JOB_KEYS;
var manifest_default = manifest;
export {
  HONCHO_ACTION_KEYS,
  HONCHO_DATA_KEYS,
  HONCHO_JOB_KEYS,
  manifest_default as default
};
//# sourceMappingURL=manifest.js.map
