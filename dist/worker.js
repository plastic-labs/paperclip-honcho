// src/worker.ts
import {
  definePlugin,
  runWorker
} from "@paperclipai/plugin-sdk";

// src/constants.ts
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
var DEFAULT_JOB_WAIT_TIMEOUT_MS = 15 * 60 * 1e3;
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
  resyncIssue: "resync-issue",
  initializeMemoryForCompany: "initialize-memory-for-company"
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
var INSTANCE_JOB_TARGETS_STATE_KEY = "instance-job-targets";

// src/manifest.ts
var PLUGIN_ID = "honcho-ai.paperclip-honcho";
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
      honchoApiKey: {
        type: "string",
        title: "Honcho API Key",
        format: "secret-ref",
        default: DEFAULT_CONFIG.honchoApiKey
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
      observe_me: {
        type: "boolean",
        title: "Observe Current Agent",
        default: DEFAULT_CONFIG.observe_me
      },
      observe_others: {
        type: "boolean",
        title: "Observe Other Participants",
        default: DEFAULT_CONFIG.observe_others
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
var manifest_default = manifest;

// src/deployment.ts
function normalizeBaseUrlForComparison(baseUrl) {
  const trimmed = baseUrl.trim();
  try {
    return new URL(trimmed).toString().replace(/\/+$/, "");
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}
function isHonchoCloudBaseUrl(baseUrl) {
  return normalizeBaseUrlForComparison(baseUrl) === normalizeBaseUrlForComparison(DEFAULT_CONFIG.honchoApiBaseUrl);
}

// src/config.ts
function normalizeBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}
function normalizeString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}
function normalizeStringArray(value, fallback) {
  if (!Array.isArray(value)) return [...fallback];
  return value.map((item) => typeof item === "string" ? item.trim() : "").filter((item) => item.length > 0);
}
function normalizeConfiguredBaseUrl(value) {
  if (typeof value !== "string") return DEFAULT_CONFIG.honchoApiBaseUrl;
  return value.trim();
}
function resolveConfig(config) {
  const input = config ?? {};
  const legacyObserveAgentPeers = normalizeBoolean(input.observeAgentPeers, DEFAULT_CONFIG.observe_me);
  return {
    honchoApiBaseUrl: normalizeConfiguredBaseUrl(input.honchoApiBaseUrl),
    honchoApiKey: normalizeString(
      input.honchoApiKey,
      normalizeString(input.honchoApiKeySecretRef, DEFAULT_CONFIG.honchoApiKey)
    ),
    workspacePrefix: normalizeString(input.workspacePrefix, DEFAULT_CONFIG.workspacePrefix) || DEFAULT_CONFIG.workspacePrefix,
    syncIssueComments: normalizeBoolean(input.syncIssueComments, DEFAULT_CONFIG.syncIssueComments),
    syncIssueDocuments: normalizeBoolean(input.syncIssueDocuments, DEFAULT_CONFIG.syncIssueDocuments),
    enablePromptContext: normalizeBoolean(input.enablePromptContext, DEFAULT_CONFIG.enablePromptContext),
    enablePeerChat: normalizeBoolean(input.enablePeerChat, DEFAULT_CONFIG.enablePeerChat),
    observe_me: typeof input.observe_me === "boolean" ? input.observe_me : typeof input.observeMe === "boolean" ? input.observeMe : legacyObserveAgentPeers,
    observe_others: typeof input.observe_others === "boolean" ? input.observe_others : typeof input.observeOthers === "boolean" ? input.observeOthers : legacyObserveAgentPeers,
    noisePatterns: normalizeStringArray(input.noisePatterns, DEFAULT_CONFIG.noisePatterns),
    disableDefaultNoisePatterns: normalizeBoolean(input.disableDefaultNoisePatterns, DEFAULT_CONFIG.disableDefaultNoisePatterns),
    stripPlatformMetadata: normalizeBoolean(input.stripPlatformMetadata, DEFAULT_CONFIG.stripPlatformMetadata),
    flushBeforeReset: normalizeBoolean(input.flushBeforeReset, DEFAULT_CONFIG.flushBeforeReset)
  };
}
async function getResolvedConfig(ctx) {
  return resolveConfig(await ctx.config.get());
}
function validateConfig(config) {
  const resolved = resolveConfig(config);
  const errors = [];
  const warnings = [];
  if (!resolved.honchoApiBaseUrl) {
    errors.push("Honcho base URL is required");
  } else {
    try {
      const parsed = new URL(resolved.honchoApiBaseUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        errors.push("Honcho base URL must use http or https");
      }
    } catch {
      errors.push("Honcho base URL must be a valid URL");
    }
  }
  if (isHonchoCloudBaseUrl(resolved.honchoApiBaseUrl) && !resolved.honchoApiKey) {
    errors.push("Honcho API key is required");
  }
  if (!resolved.syncIssueComments && !resolved.syncIssueDocuments) {
    warnings.push("Both syncIssueComments and syncIssueDocuments are disabled; the plugin will only serve connection checks and on-demand tools.");
  }
  if (resolved.enablePromptContext) {
    warnings.push("Automatic prompt injection requires a newer Paperclip host; this package currently supports manual prompt previews only.");
  }
  if (resolved.flushBeforeReset) {
    warnings.push("Flush-before-reset controls are inactive in the public-host-compatible Honcho package.");
  }
  return {
    ok: errors.length === 0,
    warnings: warnings.length > 0 ? warnings : void 0,
    errors: errors.length > 0 ? errors : void 0
  };
}
function assertConfigured(config) {
  const validation = validateConfig(config);
  if (!validation.ok) {
    throw new Error(validation.errors?.join("; ") ?? "Honcho config is invalid");
  }
}

// src/ids.ts
import { createHash } from "node:crypto";
function toHonchoSafeSegment(value) {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
}
function joinHonchoId(parts) {
  return parts.map((part) => toHonchoSafeSegment(part)).filter((part) => part.length > 0).join("_");
}
function shortStableSuffix(value) {
  return hashId(value).slice(0, 8);
}
function workspaceIdForCompany(companyId, workspacePrefix, companyName) {
  if (typeof companyName === "string" && companyName.trim()) {
    return joinHonchoId([companyName, shortStableSuffix(companyId)]);
  }
  return joinHonchoId([workspacePrefix, companyId]);
}
function peerIdForAgent(agentId, agentName) {
  if (typeof agentName === "string" && agentName.trim()) {
    return joinHonchoId(["agent", agentName, shortStableSuffix(agentId)]);
  }
  return joinHonchoId(["agent", agentId]);
}
function peerIdForUser(userId) {
  return joinHonchoId(["user", userId]);
}
function sessionIdForIssue(issueId, issueIdentifier) {
  if (typeof issueIdentifier === "string" && issueIdentifier.trim()) {
    return joinHonchoId([issueIdentifier]);
  }
  return joinHonchoId(["issue", issueId]);
}
function ownerPeerIdForCompany(companyId) {
  return joinHonchoId(["owner", "company", companyId]);
}
function systemPeerId() {
  return joinHonchoId(["system", "paperclip"]);
}
function bootstrapSessionIdForCompany(companyId) {
  return joinHonchoId(["bootstrap", "company", companyId]);
}
function bootstrapSessionIdForAgent(agentId) {
  return joinHonchoId(["bootstrap", "agent", agentId]);
}
function childSessionIdForRun(runId) {
  return joinHonchoId(["run", runId]);
}
function hashId(value) {
  return createHash("sha256").update(value).digest("hex");
}
function fileExternalId(workspaceId, relativePath) {
  return `paperclip:file:${workspaceId}:${hashId(relativePath)}`;
}
function issueEntityUrl(issue) {
  return `/issues/${issue.identifier ?? issue.id}`;
}

// src/entities.ts
async function upsertEntity(ctx, input) {
  return await ctx.entities.upsert({
    entityType: input.entityType,
    scopeKind: input.scopeKind,
    scopeId: input.scopeId,
    externalId: input.externalId,
    title: input.title ?? void 0,
    status: input.status ?? void 0,
    data: input.data
  });
}
async function upsertWorkspaceMapping(ctx, company, companyId, workspacePrefix, status = "mapped", workspaceId) {
  const existing = await getWorkspaceMappingRecord(ctx, companyId);
  const mappedWorkspaceId = typeof existing?.data.workspaceId === "string" && existing.data.workspaceId.trim() ? existing.data.workspaceId : null;
  const mappedWorkspacePrefix = typeof existing?.data.workspacePrefix === "string" && existing.data.workspacePrefix.trim() ? existing.data.workspacePrefix : null;
  const canonicalWorkspaceId = mappedWorkspaceId ?? workspaceId ?? workspaceIdForCompany(companyId, workspacePrefix, company?.name ?? null);
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
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}
async function upsertSessionMapping(ctx, issue, workspaceId) {
  const existing = await getSessionMappingRecord(ctx, issue.id);
  const mappedSessionId = typeof existing?.data.sessionId === "string" && existing.data.sessionId.trim() ? existing.data.sessionId : null;
  const sessionId = mappedSessionId ?? sessionIdForIssue(issue.id, issue.identifier ?? null);
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
      sessionId,
      workspaceId,
      issueTitle: issue.title,
      issueStatus: issue.status,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}
async function upsertBootstrapSessionMapping(ctx, companyId, input) {
  const sessionId = input.kind === "company" ? bootstrapSessionIdForCompany(companyId) : input.kind === "agent" && input.agentId ? bootstrapSessionIdForAgent(input.agentId) : childSessionIdForRun(input.runId ?? "unknown");
  const externalId = input.kind === "company" ? `paperclip:bootstrap:company:${companyId}` : input.kind === "agent" && input.agentId ? `paperclip:bootstrap:agent:${input.agentId}` : `paperclip:run:${input.runId}`;
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
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}
async function upsertAgentPeerMapping(ctx, companyId, agent, status = "mapped") {
  const peerId = peerIdForAgent(agent.id, agent.name);
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
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}
async function upsertUserPeerMapping(ctx, companyId, userId, status = "mapped") {
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
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}
async function upsertOwnerPeerMapping(ctx, companyId, status = "mapped") {
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
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}
async function upsertSystemPeerMapping(ctx, companyId, status = "mapped") {
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
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}
async function ensureActorPeerMapping(ctx, companyId, actor) {
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
async function upsertImportLedger(ctx, companyId, input) {
  return await upsertEntity(ctx, {
    entityType: ENTITY_TYPES.importLedger,
    scopeKind: "company",
    scopeId: companyId,
    externalId: input.externalId,
    title: input.issueIdentifier ?? input.issueId,
    status: "imported",
    data: {
      ...input,
      lastSeenAt: input.importedAt
    }
  });
}
async function getImportLedgerRecord(ctx, companyId, externalId) {
  const records = await ctx.entities.list({
    entityType: ENTITY_TYPES.importLedger,
    scopeKind: "company",
    scopeId: companyId,
    externalId,
    limit: 1
  });
  return records[0] ?? null;
}
async function getWorkspaceMappingRecord(ctx, companyId) {
  const records = await ctx.entities.list({
    entityType: ENTITY_TYPES.workspaceMapping,
    scopeKind: "company",
    scopeId: companyId,
    externalId: `paperclip:company:${companyId}`,
    limit: 1
  });
  return records[0] ?? null;
}
async function getSessionMappingRecord(ctx, issueId) {
  const records = await ctx.entities.list({
    entityType: ENTITY_TYPES.sessionMapping,
    scopeKind: "issue",
    scopeId: issueId,
    externalId: `paperclip:issue:${issueId}`,
    limit: 1
  });
  return records[0] ?? null;
}
async function resolveCanonicalWorkspaceId(ctx, companyId, workspacePrefix) {
  const company = await ctx.companies.get(companyId);
  const expectedWorkspaceId = workspaceIdForCompany(companyId, workspacePrefix, company?.name ?? null);
  const mapping = await getWorkspaceMappingRecord(ctx, companyId);
  const mappedWorkspaceId = typeof mapping?.data.workspaceId === "string" && mapping.data.workspaceId.trim() ? mapping.data.workspaceId : null;
  if (mappedWorkspaceId) {
    if (mappedWorkspaceId !== expectedWorkspaceId) {
      throw new Error(
        `Workspace mapping mismatch for company '${companyId}': mapped workspace '${mappedWorkspaceId}' does not match expected workspace '${expectedWorkspaceId}'`
      );
    }
    return mappedWorkspaceId;
  }
  return expectedWorkspaceId;
}
async function resolveCanonicalIssueSessionId(ctx, issueId, issueIdentifier) {
  const mapping = await getSessionMappingRecord(ctx, issueId);
  const mappedSessionId = typeof mapping?.data.sessionId === "string" && mapping.data.sessionId.trim() ? mapping.data.sessionId : null;
  return mappedSessionId ?? sessionIdForIssue(issueId, issueIdentifier);
}
async function upsertMigrationReport(ctx, companyId, reportType, payload) {
  return await upsertEntity(ctx, {
    entityType: ENTITY_TYPES.migrationReport,
    scopeKind: "company",
    scopeId: companyId,
    externalId: `paperclip:${reportType}:${companyId}`,
    title: `${reportType}:${companyId}`,
    status: "ready",
    data: payload
  });
}
async function upsertFileImportSource(ctx, companyId, input) {
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
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}
async function listMappingCounts(ctx, companyId) {
  const [peers, sessions, ledger] = await Promise.all([
    ctx.entities.list({
      entityType: ENTITY_TYPES.peerMapping,
      scopeKind: "company",
      scopeId: companyId,
      limit: 500
    }),
    ctx.entities.list({
      entityType: ENTITY_TYPES.sessionMapping,
      scopeKind: "issue",
      limit: 500
    }),
    ctx.entities.list({
      entityType: ENTITY_TYPES.importLedger,
      scopeKind: "company",
      scopeId: companyId,
      limit: 1e3
    })
  ]);
  return {
    mappedPeers: peers.length,
    mappedSessions: sessions.filter((record) => record.data.companyId === companyId).length,
    importedComments: ledger.filter((record) => record.data.sourceType === "issue_comment").length,
    importedDocuments: ledger.filter((record) => record.data.sourceType === "issue_document").length,
    importedRuns: ledger.filter((record) => record.data.sourceType === "run_transcript").length,
    importedFiles: ledger.filter((record) => String(record.data.sourceType).includes("file")).length
  };
}
async function listJobsForUi(ctx) {
  return (ctx.manifest.jobs ?? []).map((job) => ({
    id: job.jobKey,
    jobKey: job.jobKey,
    displayName: job.displayName,
    status: "ready"
  }));
}
function buildMigrationReportPayload(companyId, preview) {
  return {
    companyId,
    preview,
    generatedAt: preview.generatedAt
  };
}

// src/honcho-client.ts
var RATE_LIMIT_MAX_RETRIES = 4;
var RATE_LIMIT_BASE_DELAY_MS = 250;
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
async function parseJson(res) {
  if (!res) return {};
  if ("json" in res) {
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  }
  return res.body ? JSON.parse(res.body) : {};
}
function isRateLimitError(status, message) {
  return status === 429 || /rate limit exceeded/i.test(message);
}
function getRetryDelayMs(res, attempt) {
  if ("headers" in res && typeof res.headers?.get === "function") {
    const retryAfter = res.headers.get("retry-after");
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds) && seconds > 0) {
        return Math.ceil(seconds * 1e3);
      }
      const retryAt = Date.parse(retryAfter);
      if (Number.isFinite(retryAt)) {
        return Math.max(0, retryAt - Date.now());
      }
    }
  }
  return RATE_LIMIT_BASE_DELAY_MS * Math.pow(2, attempt);
}
function joinUrl(baseUrl, pathname) {
  return `${baseUrl.replace(/\/+$/, "")}${pathname}`;
}
function buildIssueContextPreview(payload) {
  const candidates = [];
  const summaryText = typeof payload.summary === "string" ? payload.summary : typeof payload.summary?.content === "string" ? payload.summary.content : null;
  if (typeof summaryText === "string" && summaryText.trim()) {
    candidates.push(summaryText.trim());
  }
  if (typeof payload.context === "string" && payload.context.trim()) {
    candidates.push(payload.context.trim());
  } else if (typeof payload.content === "string" && payload.content.trim()) {
    candidates.push(payload.content.trim());
  }
  if (candidates.length === 0 && Array.isArray(payload.messages)) {
    const messagePreview = payload.messages.map((message) => typeof message.content === "string" ? message.content.trim() : "").filter((value) => value.length > 0).slice(0, DEFAULT_CONTEXT_SUMMARY_LIMIT).join("\n\n").trim();
    if (messagePreview) candidates.push(messagePreview);
  }
  return candidates[0] ?? null;
}
function buildRepresentationPreview(payload) {
  if (typeof payload.representation === "string" && payload.representation.trim()) {
    return payload.representation.trim();
  }
  if (typeof payload.summary === "string" && payload.summary.trim()) {
    return payload.summary.trim();
  }
  if (typeof payload.content === "string" && payload.content.trim()) {
    return payload.content.trim();
  }
  if (Array.isArray(payload.results)) {
    const preview = payload.results.map((result) => typeof result.content === "string" ? result.content.trim() : "").filter(Boolean).slice(0, DEFAULT_CONTEXT_SUMMARY_LIMIT).join("\n\n").trim();
    return preview || null;
  }
  return null;
}
async function requestJson(ctx, config, apiKey, pathname, init) {
  for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt += 1) {
    const headers = {
      "content-type": "application/json"
    };
    if (apiKey) {
      headers.authorization = `Bearer ${apiKey}`;
    }
    const res = await ctx.http.fetch(joinUrl(config.honchoApiBaseUrl, pathname), {
      ...init,
      headers: {
        ...headers,
        ...init.headers ?? {}
      }
    });
    if (!res) {
      if (attempt < RATE_LIMIT_MAX_RETRIES) {
        await sleep(RATE_LIMIT_BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }
      throw new Error(`${pathname} returned no response`);
    }
    const status = res.status;
    if (status >= 200 && status < 300) {
      return await parseJson(res);
    }
    let message = `${pathname} failed with status ${status}`;
    try {
      const payload = await parseJson(res);
      if (typeof payload.error === "string") {
        message = `${pathname} failed: ${payload.error}`;
      } else if (typeof payload.message === "string") {
        message = `${pathname} failed: ${payload.message}`;
      }
    } catch {
    }
    if (isRateLimitError(status, message) && attempt < RATE_LIMIT_MAX_RETRIES) {
      await sleep(getRetryDelayMs(res, attempt));
      continue;
    }
    throw new Error(message);
  }
  throw new Error(`${pathname} failed after exhausting retries`);
}
var HonchoClient = class {
  ctx;
  config;
  apiKey;
  ensuredWorkspaces = /* @__PURE__ */ new Set();
  ensuredSessions = /* @__PURE__ */ new Set();
  ensuredPeers = /* @__PURE__ */ new Set();
  resolvedWorkspaceIds = /* @__PURE__ */ new Map();
  resolvedSessionIds = /* @__PURE__ */ new Map();
  constructor(input) {
    this.ctx = input.ctx;
    this.config = input.config;
    this.apiKey = input.apiKey;
  }
  async workspaceId(companyId) {
    const cachedWorkspaceId = this.resolvedWorkspaceIds.get(companyId);
    if (cachedWorkspaceId) {
      return cachedWorkspaceId;
    }
    const workspaceId = await resolveCanonicalWorkspaceId(this.ctx, companyId, this.config.workspacePrefix);
    this.resolvedWorkspaceIds.set(companyId, workspaceId);
    return workspaceId;
  }
  async sessionId(companyId, issueId, issue) {
    const cacheKey = `${companyId}:${issueId}`;
    const cachedSessionId = this.resolvedSessionIds.get(cacheKey);
    if (cachedSessionId) {
      return cachedSessionId;
    }
    const resolvedIssue = issue ?? await this.ctx.issues.get(issueId, companyId);
    const sessionId = await resolveCanonicalIssueSessionId(
      this.ctx,
      issueId,
      resolvedIssue?.identifier ?? null
    );
    this.resolvedSessionIds.set(cacheKey, sessionId);
    return sessionId;
  }
  async agentPeerId(companyId, agentId) {
    const agent = await this.ctx.agents.get(agentId, companyId);
    return peerIdForAgent(agentId, agent?.name ?? null);
  }
  async ensureWorkspace(companyId) {
    const workspaceId = await this.workspaceId(companyId);
    if (this.ensuredWorkspaces.has(workspaceId)) {
      return workspaceId;
    }
    await requestJson(this.ctx, this.config, this.apiKey, `${HONCHO_V3_PATH}/workspaces`, {
      method: "POST",
      body: JSON.stringify({
        id: workspaceId
      })
    });
    this.ensuredWorkspaces.add(workspaceId);
    return workspaceId;
  }
  async ensureCompanyWorkspace(companyId, company) {
    const workspaceId = await this.workspaceId(companyId);
    if (this.ensuredWorkspaces.has(workspaceId)) {
      return workspaceId;
    }
    await requestJson(this.ctx, this.config, this.apiKey, `${HONCHO_V3_PATH}/workspaces`, {
      method: "POST",
      body: JSON.stringify({
        id: workspaceId
      })
    });
    this.ensuredWorkspaces.add(workspaceId);
    return workspaceId;
  }
  async probeConnection(companyId, company) {
    if (!companyId) {
      return { workspaceId: null };
    }
    const workspaceId = await this.ensureCompanyWorkspace(companyId, company ?? null);
    return { workspaceId };
  }
  async ensurePeer(companyId, peerId, metadata, peerConfig) {
    const workspaceId = await this.ensureWorkspace(companyId);
    const cacheKey = `${workspaceId}:${peerId}`;
    if (this.ensuredPeers.has(cacheKey)) {
      return peerId;
    }
    await requestJson(this.ctx, this.config, this.apiKey, `${HONCHO_V3_PATH}/workspaces/${encodeURIComponent(workspaceId)}/peers`, {
      method: "POST",
      body: JSON.stringify({
        id: peerId,
        configuration: peerConfig,
        metadata: {
          source_system: "paperclip",
          ...metadata
        }
      })
    });
    this.ensuredPeers.add(cacheKey);
    return peerId;
  }
  async ensureAgentPeer(companyId, agent) {
    return await this.ensurePeer(
      companyId,
      peerIdForAgent(agent.id, agent.name),
      {
        company_id: companyId,
        agent_id: agent.id,
        agent_name: agent.name,
        agent_role: agent.role,
        agent_title: agent.title
      },
      {
        observe_me: this.config.observe_me,
        observe_others: this.config.observe_others
      }
    );
  }
  async ensureUserPeer(companyId, userId, metadata) {
    return await this.ensurePeer(
      companyId,
      peerIdForUser(userId),
      {
        company_id: companyId,
        user_id: userId,
        ...metadata
      }
    );
  }
  async ensureSession(companyId, issueId, metadata) {
    return await this.ensureRawSession(companyId, await this.sessionId(companyId, issueId), {
      source_system: "paperclip",
      company_id: companyId,
      issue_id: issueId,
      ...metadata
    });
  }
  async ensureRawSession(companyId, sessionId, metadata) {
    const workspaceId = await this.ensureWorkspace(companyId);
    const cacheKey = `${workspaceId}:${sessionId}`;
    if (this.ensuredSessions.has(cacheKey)) {
      return sessionId;
    }
    await requestJson(this.ctx, this.config, this.apiKey, `${HONCHO_V3_PATH}/workspaces/${encodeURIComponent(workspaceId)}/sessions`, {
      method: "POST",
      body: JSON.stringify({
        id: sessionId,
        metadata
      })
    });
    this.ensuredSessions.add(cacheKey);
    return sessionId;
  }
  async ensureIssueSession(issue, company) {
    const workspaceId = await this.ensureCompanyWorkspace(issue.companyId, company);
    const sessionId = await this.sessionId(issue.companyId, issue.id, issue);
    const cacheKey = `${workspaceId}:${sessionId}`;
    if (this.ensuredSessions.has(cacheKey)) {
      return sessionId;
    }
    await requestJson(this.ctx, this.config, this.apiKey, `${HONCHO_V3_PATH}/workspaces/${encodeURIComponent(workspaceId)}/sessions`, {
      method: "POST",
      body: JSON.stringify({
        id: sessionId,
        metadata: {
          source_system: "paperclip",
          company_id: issue.companyId,
          company_name: company?.name ?? null,
          issue_id: issue.id,
          issue_identifier: issue.identifier,
          issue_title: issue.title,
          issue_status: issue.status,
          project_id: issue.projectId,
          goal_id: issue.goalId,
          assignee_agent_id: issue.assigneeAgentId,
          assignee_user_id: issue.assigneeUserId
        }
      })
    });
    this.ensuredSessions.add(cacheKey);
    return sessionId;
  }
  async appendMessages(companyId, issueId, messages) {
    if (messages.length === 0) return;
    const sessionId = await this.ensureSession(companyId, issueId);
    await this.appendMessagesToSession(companyId, sessionId, messages);
  }
  async appendMessagesToSession(companyId, sessionId, messages) {
    if (messages.length === 0) return;
    const workspaceId = await this.workspaceId(companyId);
    await requestJson(
      this.ctx,
      this.config,
      this.apiKey,
      `${HONCHO_V3_PATH}/workspaces/${encodeURIComponent(workspaceId)}/sessions/${encodeURIComponent(sessionId)}/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          messages: messages.map((message) => ({
            peer_id: message.peerId,
            content: message.content,
            created_at: message.createdAt,
            metadata: message.metadata
          }))
        })
      }
    );
  }
  async listSessionMessageMetadata(companyId, sessionId) {
    const workspaceId = await this.workspaceId(companyId);
    const items = [];
    let page = 1;
    let pages = 1;
    while (page <= pages) {
      const payload = await requestJson(
        this.ctx,
        this.config,
        this.apiKey,
        `${HONCHO_V3_PATH}/workspaces/${encodeURIComponent(workspaceId)}/sessions/${encodeURIComponent(sessionId)}/messages/list?page=${page}&size=200`,
        {
          method: "POST",
          body: JSON.stringify({})
        }
      );
      const nextItems = Array.isArray(payload.items) ? payload.items : [];
      for (const item of nextItems) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const metadata = item.metadata;
          if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
            items.push(metadata);
          }
        }
      }
      pages = typeof payload.pages === "number" && Number.isFinite(payload.pages) && payload.pages > 0 ? payload.pages : page;
      page += 1;
    }
    return items;
  }
  async getIssueContext(companyId, issueId, userPeerId) {
    const sessionId = await this.ensureSession(companyId, issueId);
    return await this.getSessionContext(companyId, sessionId, userPeerId, issueId);
  }
  async getSessionContext(companyId, sessionId, userPeerId, issueId) {
    const workspaceId = await this.workspaceId(companyId);
    const query = new URLSearchParams({
      summary: "true",
      tokens: String(DEFAULT_CONTEXT_TOKEN_LIMIT)
    });
    if (userPeerId) {
      query.set("peer_target", userPeerId);
    }
    const payload = await requestJson(
      this.ctx,
      this.config,
      this.apiKey,
      `${HONCHO_V3_PATH}/workspaces/${encodeURIComponent(workspaceId)}/sessions/${encodeURIComponent(sessionId)}/context?${query.toString()}`,
      {
        method: "GET"
      }
    );
    const contextPayload = payload;
    const summaryContent = typeof contextPayload.summary === "string" ? contextPayload.summary : typeof contextPayload.summary?.content === "string" ? contextPayload.summary.content : null;
    const summaries = summaryContent && summaryContent.trim() ? [{ summary: summaryContent }] : Array.isArray(contextPayload.messages) ? contextPayload.messages.reduce((items, message) => {
      if (typeof message.content === "string" && message.content.trim()) {
        items.push({ content: message.content, metadata: message.metadata ?? null });
      }
      return items;
    }, []).slice(0, DEFAULT_CONTEXT_SUMMARY_LIMIT) : [];
    const preview = buildIssueContextPreview(contextPayload);
    return {
      issueId: issueId ?? sessionId,
      issueIdentifier: null,
      sessionId,
      workspaceId,
      summaries,
      context: contextPayload,
      preview
    };
  }
  async getPeerRepresentation(companyId, agentId, params) {
    const workspaceId = await this.workspaceId(companyId);
    const agentPeerId = await this.agentPeerId(companyId, agentId);
    const payload = await requestJson(
      this.ctx,
      this.config,
      this.apiKey,
      `${HONCHO_V3_PATH}/workspaces/${encodeURIComponent(workspaceId)}/peers/${encodeURIComponent(agentPeerId)}/representation`,
      {
        method: "POST",
        body: JSON.stringify({
          ...params.issueId ? { session_id: await this.sessionId(companyId, params.issueId) } : {},
          ...params.summaryOnly ? { summary_only: true } : {}
        })
      }
    );
    return buildRepresentationPreview(payload);
  }
  async searchMemory(companyId, agentId, params) {
    const agent = await this.ctx.agents.get(agentId, companyId);
    const agentPeerId = peerIdForAgent(agentId, agent?.name ?? null);
    if (agent) {
      await this.ensureAgentPeer(companyId, agent);
    } else {
      await this.ensurePeer(companyId, agentPeerId, {
        company_id: companyId,
        agent_id: agentId
      }, {
        observe_me: this.config.observe_me,
        observe_others: this.config.observe_others
      });
    }
    const workspaceId = await this.workspaceId(companyId);
    const scopedSessionId = params.scope === "workspace" ? void 0 : params.issueId ? await this.sessionId(companyId, params.issueId) : void 0;
    const payload = await requestJson(
      this.ctx,
      this.config,
      this.apiKey,
      `${HONCHO_V3_PATH}/workspaces/${encodeURIComponent(workspaceId)}/peers/${encodeURIComponent(agentPeerId)}/representation`,
      {
        method: "POST",
        body: JSON.stringify({
          session_id: scopedSessionId,
          target: scopedSessionId,
          search_query: params.query,
          search_top_k: params.limit,
          ...params.summaryOnly ? { summary_only: true } : {}
        })
      }
    );
    const data = payload;
    if (Array.isArray(data.results)) return data.results;
    if (typeof data.representation === "string" && data.representation.trim()) {
      return [{ id: "representation", content: data.representation, metadata: data.metadata ?? null, score: null }];
    }
    if (typeof data.content === "string" && data.content.trim()) {
      return [{ id: "content", content: data.content, metadata: data.metadata ?? null, score: null }];
    }
    return [];
  }
  async askPeer(companyId, agentId, params) {
    const workspaceId = await this.ensureWorkspace(companyId);
    const agentPeerId = await this.agentPeerId(companyId, agentId);
    const payload = await requestJson(
      this.ctx,
      this.config,
      this.apiKey,
      `${HONCHO_V3_PATH}/workspaces/${encodeURIComponent(workspaceId)}/peers/${encodeURIComponent(agentPeerId)}/chat`,
      {
        method: "POST",
        body: JSON.stringify({
          target: params.targetPeerId,
          query: params.query,
          session_id: params.issueId ? await this.sessionId(companyId, params.issueId) : void 0
        })
      }
    );
    return payload;
  }
  async getWorkspaceContext(companyId, agentId, query) {
    return await this.searchMemory(companyId, agentId, {
      query,
      scope: "workspace",
      limit: DEFAULT_CONTEXT_SUMMARY_LIMIT
    });
  }
};
async function createHonchoClient(input) {
  const apiKey = input.config.honchoApiKey ? await input.ctx.secrets.resolve(input.config.honchoApiKey) : null;
  return new HonchoClient({ ...input, apiKey });
}

// src/state.ts
var EMPTY_ISSUE_STATUS = {
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
  latestHierarchyContextPreview: null
};
var EMPTY_COMPANY_STATUS = {
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
  latestMigrationPreview: null
};
var EMPTY_COMPANY_CHECKPOINT = {
  activeJobKey: null,
  status: "idle",
  processed: 0,
  succeeded: 0,
  skipped: 0,
  failed: 0,
  currentSourceType: null,
  currentEntityId: null,
  lastError: null,
  updatedAt: null
};
function issueStateKey(issueId) {
  return {
    scopeKind: "issue",
    scopeId: issueId,
    namespace: STATE_NAMESPACE,
    stateKey: ISSUE_STATUS_STATE_KEY
  };
}
function companyStateKey(companyId) {
  return {
    scopeKind: "company",
    scopeId: companyId,
    namespace: STATE_NAMESPACE,
    stateKey: COMPANY_STATUS_STATE_KEY
  };
}
function companyCheckpointStateKey(companyId) {
  return {
    scopeKind: "company",
    scopeId: companyId,
    namespace: STATE_NAMESPACE,
    stateKey: COMPANY_CHECKPOINT_STATE_KEY
  };
}
function instanceJobTargetsStateKey() {
  return {
    scopeKind: "instance",
    namespace: STATE_NAMESPACE,
    stateKey: INSTANCE_JOB_TARGETS_STATE_KEY
  };
}
async function getIssueSyncStatus(ctx, issueId) {
  const value = await ctx.state.get(issueStateKey(issueId));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_ISSUE_STATUS };
  }
  return { ...EMPTY_ISSUE_STATUS, ...value };
}
async function setIssueSyncStatus(ctx, issueId, status) {
  await ctx.state.set(issueStateKey(issueId), status);
}
async function patchIssueSyncStatus(ctx, issueId, patch) {
  const next = { ...await getIssueSyncStatus(ctx, issueId), ...patch };
  await setIssueSyncStatus(ctx, issueId, next);
  return next;
}
async function clearIssueSyncStatus(ctx, issueId) {
  await ctx.state.delete(issueStateKey(issueId));
}
async function getCompanySyncStatus(ctx, companyId) {
  const value = await ctx.state.get(companyStateKey(companyId));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_COMPANY_STATUS };
  }
  return { ...EMPTY_COMPANY_STATUS, ...value };
}
async function patchCompanySyncStatus(ctx, companyId, patch) {
  const next = { ...await getCompanySyncStatus(ctx, companyId), ...patch };
  await ctx.state.set(companyStateKey(companyId), next);
  return next;
}
async function getCompanyCheckpoint(ctx, companyId) {
  const value = await ctx.state.get(companyCheckpointStateKey(companyId));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_COMPANY_CHECKPOINT };
  }
  return { ...EMPTY_COMPANY_CHECKPOINT, ...value };
}
async function patchCompanyCheckpoint(ctx, companyId, patch) {
  const next = { ...await getCompanyCheckpoint(ctx, companyId), ...patch };
  await ctx.state.set(companyCheckpointStateKey(companyId), next);
  return next;
}
async function getInstanceJobTargets(ctx) {
  const value = await ctx.state.get(instanceJobTargetsStateKey());
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...value };
}
async function setPreparedJobCompany(ctx, jobKey, companyId) {
  const next = {
    ...await getInstanceJobTargets(ctx),
    [jobKey]: companyId
  };
  await ctx.state.set(instanceJobTargetsStateKey(), next);
}
async function consumePreparedJobCompany(ctx, jobKey) {
  const targets = await getInstanceJobTargets(ctx);
  const companyId = typeof targets[jobKey] === "string" && targets[jobKey].trim().length > 0 ? targets[jobKey] : null;
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
function buildSyncErrorSummary(input) {
  return {
    at: (/* @__PURE__ */ new Date()).toISOString(),
    message: input.message,
    code: input.code ?? null,
    issueId: input.issueId ?? null,
    commentId: input.commentId ?? null,
    documentKey: input.documentKey ?? null
  };
}

// src/provenance.ts
function actorFromComment(comment) {
  if (comment.authorAgentId) {
    return { authorType: "agent", authorId: comment.authorAgentId };
  }
  if (comment.authorUserId) {
    return { authorType: "user", authorId: comment.authorUserId };
  }
  return { authorType: "system", authorId: "paperclip" };
}
function actorFromDocumentRevision(revision) {
  if (revision.createdByAgentId) {
    return { authorType: "agent", authorId: revision.createdByAgentId };
  }
  if (revision.createdByUserId) {
    return { authorType: "user", authorId: revision.createdByUserId };
  }
  return { authorType: "system", authorId: "paperclip" };
}
function buildCommentProvenance(issue, comment, actor) {
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
    ingestedAt: (/* @__PURE__ */ new Date()).toISOString(),
    contentType: "issue_comment"
  };
}
function buildDocumentProvenance(issue, revision, actor) {
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
    ingestedAt: (/* @__PURE__ */ new Date()).toISOString(),
    contentType: "issue_document_section"
  };
}
function splitDocumentIntoSections(document, revision, sectionSize, overlap) {
  const body = revision.body;
  if (!body.trim()) return [];
  const sections = [];
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
        content
      });
    }
    if (end >= body.length) break;
    start = Math.max(end - safeOverlap, start + 1);
    index += 1;
  }
  return sections;
}

// src/sync.ts
var migrationCandidatesLoaderOverride = null;
var issueSyncQueue = /* @__PURE__ */ new Map();
async function resolvePeerIdFromActor(ctx, companyId, actor) {
  if (actor.authorType === "agent") {
    const agent = await ctx.agents.get(actor.authorId, companyId);
    return peerIdForAgent(actor.authorId, agent?.name ?? null);
  }
  if (actor.authorType === "user") return peerIdForUser(actor.authorId);
  return systemPeerId();
}
function compareComments(left, right) {
  return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
}
function compareRevisions(left, right) {
  return left.revisionNumber - right.revisionNumber;
}
function toDocumentRevision(issueId, document) {
  return {
    id: document.latestRevisionId ?? `${document.id}:latest`,
    documentId: document.id ?? `${issueId}:${document.key}`,
    issueId,
    key: document.key,
    revisionNumber: document.latestRevisionNumber ?? 1,
    body: document.body ?? "",
    createdByAgentId: document.updatedByAgentId ?? document.createdByAgentId ?? null,
    createdByUserId: document.updatedByUserId ?? document.createdByUserId ?? null,
    createdAt: document.updatedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    changeSummary: null
  };
}
async function listDocumentBundles(ctx, issueId, companyId) {
  const summaries = await ctx.issues.documents.list(issueId, companyId);
  const documents = await Promise.all(
    summaries.map(async (summary) => await ctx.issues.documents.get(issueId, summary.key, companyId))
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
        createdByUserId: document.createdByUserId ?? null
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
        createdByUserId: document.createdByUserId ?? null
      })]
    }];
  });
}
function cleanNormalizedLines(raw, config) {
  const noisePatterns = buildNoisePatterns(config);
  const seen = /* @__PURE__ */ new Set();
  const kept = [];
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
  const boundedContent = content.length > DEFAULT_MAX_INGEST_MESSAGE_CHARS ? `${content.slice(0, Math.max(0, DEFAULT_MAX_INGEST_MESSAGE_CHARS - 1)).trimEnd()}\u2026` : content;
  const normalized = normalizeText(boundedContent);
  if (!normalized || normalized.length < DEFAULT_MIN_IMPORT_TEXT_LENGTH) return null;
  const nonPrintable = normalized.replace(/[\x20-\x7E]/g, "");
  if (nonPrintable.length > Math.max(4, normalized.length * 0.15)) return null;
  if (noisePatterns.some((pattern) => pattern.test(normalized))) return null;
  return {
    content: boundedContent,
    fingerprint: buildFingerprint([normalized])
  };
}
async function ensureActorPeer(ctx, companyId, actor, client) {
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
    system_id: "paperclip"
  });
}
async function ensureIssueTopology(ctx, resources, client, config) {
  const workspaceId = await client.ensureCompanyWorkspace(resources.issue.companyId, resources.company);
  await upsertWorkspaceMapping(ctx, resources.company, resources.issue.companyId, config.workspacePrefix);
  await client.ensureIssueSession(resources.issue, resources.company);
  await upsertSessionMapping(ctx, resources.issue, workspaceId);
  const actorKeys = /* @__PURE__ */ new Set();
  const queueActor = (actor) => {
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
        authorType,
        authorId
      },
      client
    );
  }
}
async function fetchIssueResources(ctx, issueId, companyId, config) {
  const [issue, company] = await Promise.all([
    ctx.issues.get(issueId, companyId),
    ctx.companies.get(companyId)
  ]);
  if (!issue) {
    throw new Error("Issue not found");
  }
  const comments = (await ctx.issues.listComments(issueId, companyId)).sort(compareComments);
  const documents = config.syncIssueDocuments ? await listDocumentBundles(ctx, issueId, companyId) : [];
  return { issue, company, comments, documents };
}
async function buildCommentMessages(ctx, issue, comments, config, replay, lastSyncedCommentId) {
  const started = replay || !lastSyncedCommentId;
  const messages = [];
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
        issueStatus: issue.status
      }
    });
  }
  return messages;
}
async function buildDocumentMessages(ctx, issue, documents, config, lastSyncedRevisionId) {
  const messages = [];
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
        DEFAULT_DOCUMENT_SECTION_OVERLAP
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
            sectionIndex: section.index
          }
        });
      }
    }
  }
  return messages;
}
function formatSearchResults(results) {
  const lines = results.map((result, index) => {
    const content = typeof result.content === "string" ? result.content.trim() : "";
    if (!content) return null;
    return `${index + 1}. ${content}`;
  }).filter((value) => Boolean(value));
  return lines.length > 0 ? lines.join("\n") : null;
}
async function refreshContextPreview(ctx, issue, company, config, client) {
  const resolvedClient = client ?? await createHonchoClient({ ctx, config });
  await resolvedClient.ensureCompanyWorkspace(issue.companyId, company);
  await resolvedClient.ensureIssueSession(issue, company);
  const targetUserId = issue.assigneeUserId ?? issue.createdByUserId ?? null;
  const context = await resolvedClient.getIssueContext(
    issue.companyId,
    issue.id,
    targetUserId ? peerIdForUser(targetUserId) : null
  );
  await patchIssueSyncStatus(ctx, issue.id, {
    latestContextPreview: context.preview,
    latestContextFetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
    lastError: null
  });
  return {
    ...context,
    issueIdentifier: issue.identifier ?? null
  };
}
function normalizeText(value) {
  return value.trim().replace(/\s+/g, " ");
}
function buildFingerprint(parts) {
  return parts.map((part) => normalizeText(part)).join("|");
}
function buildNoisePatterns(config) {
  const patterns = [
    ...config.disableDefaultNoisePatterns ? [] : DEFAULT_NOISE_PATTERNS,
    ...config.noisePatterns
  ];
  return patterns.map((pattern) => {
    try {
      return new RegExp(pattern, "i");
    } catch {
      return /^$/;
    }
  });
}
function normalizeAndFilterMessage(raw, config) {
  return cleanNormalizedLines(raw, config);
}
async function listCompanyIssues(ctx, companyId) {
  const issues = [];
  let offset = 0;
  while (true) {
    const batch = await ctx.issues.list({
      companyId,
      limit: DEFAULT_BACKFILL_BATCH_SIZE,
      offset
    });
    if (batch.length === 0) break;
    issues.push(...batch);
    offset += batch.length;
  }
  return issues;
}
async function listCompanyAgents(ctx, companyId) {
  return await ctx.agents.list({
    companyId,
    limit: DEFAULT_BACKFILL_BATCH_SIZE,
    offset: 0
  });
}
async function buildMigrationCandidates(ctx, companyId) {
  const config = await getResolvedConfig(ctx);
  const issues = await listCompanyIssues(ctx, companyId);
  const candidates = [];
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
          issueStatus: issue.status
        }
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
            DEFAULT_DOCUMENT_SECTION_OVERLAP
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
                sectionIndex: section.index
              }
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
async function loadMigrationCandidates(ctx, companyId) {
  const candidates = migrationCandidatesLoaderOverride ? await migrationCandidatesLoaderOverride(ctx, companyId) : await buildMigrationCandidates(ctx, companyId);
  return await filterAlreadySyncedMigrationCandidates(ctx, candidates);
}
function extractDocumentRevisionId(candidate) {
  if (candidate.sourceType !== "issue_documents") return null;
  const [revisionId] = candidate.sourceId.split(":", 1);
  return revisionId?.trim() ? revisionId : null;
}
function candidateSessionProvenanceKey(candidate) {
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
function metadataSessionProvenanceKeys(metadata) {
  const keys = [];
  if (typeof metadata.commentId === "string" && metadata.commentId.trim()) {
    keys.push(`comment:${metadata.commentId}`);
  }
  if (typeof metadata.documentRevisionId === "string" && metadata.documentRevisionId.trim() && typeof metadata.sectionKey === "string" && metadata.sectionKey.trim()) {
    keys.push(`document:${metadata.documentRevisionId}:${metadata.sectionKey}`);
  }
  return keys;
}
function coveredCommentIds(candidates, lastSyncedCommentId, lastSyncedCommentCreatedAt) {
  if (!lastSyncedCommentId && !lastSyncedCommentCreatedAt) {
    return /* @__PURE__ */ new Set();
  }
  const cutoff = lastSyncedCommentCreatedAt ? Date.parse(lastSyncedCommentCreatedAt) : Number.NaN;
  const covered = /* @__PURE__ */ new Set();
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
  return /* @__PURE__ */ new Set();
}
function coveredDocumentRevisionIds(candidates, lastSyncedDocumentRevisionId) {
  if (!lastSyncedDocumentRevisionId) {
    return /* @__PURE__ */ new Set();
  }
  const covered = /* @__PURE__ */ new Set();
  for (const candidate of candidates) {
    const revisionId = extractDocumentRevisionId(candidate);
    if (!revisionId) continue;
    covered.add(revisionId);
    if (revisionId === lastSyncedDocumentRevisionId) {
      return covered;
    }
  }
  return /* @__PURE__ */ new Set();
}
async function filterAlreadySyncedMigrationCandidates(ctx, candidates) {
  const byIssue = /* @__PURE__ */ new Map();
  for (const candidate of candidates) {
    if (!candidate.issueId) continue;
    const existing = byIssue.get(candidate.issueId) ?? [];
    existing.push(candidate);
    byIssue.set(candidate.issueId, existing);
  }
  const coverage = /* @__PURE__ */ new Map();
  for (const [issueId, issueCandidates] of byIssue.entries()) {
    const status = await getIssueSyncStatus(ctx, issueId);
    coverage.set(issueId, {
      commentIds: coveredCommentIds(issueCandidates, status.lastSyncedCommentId, status.lastSyncedCommentCreatedAt),
      revisionIds: coveredDocumentRevisionIds(issueCandidates, status.lastSyncedDocumentRevisionId)
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
async function runIssueSyncExclusive(companyId, issueId, work) {
  const queueKey = `${companyId}:${issueId}`;
  const previous = issueSyncQueue.get(queueKey) ?? Promise.resolve();
  let release = () => {
  };
  const current = new Promise((resolve) => {
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
function buildMigrationPreview(companyId, candidates) {
  const comments = candidates.filter((candidate) => candidate.sourceType === "issue_comments");
  const documents = candidates.filter((candidate) => candidate.sourceType === "issue_documents");
  const files = candidates.filter((candidate) => !["issue_comments", "issue_documents"].includes(candidate.sourceType));
  const issueMap = /* @__PURE__ */ new Map();
  const warnings = [];
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
      estimatedMessages: 0
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
      files: files.length
    },
    issues,
    estimatedMessages: candidates.length,
    warnings,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function patchJobProgress(ctx, companyId, patch) {
  return await patchCompanyCheckpoint(ctx, companyId, {
    ...patch,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function buildMemoryStatusData(ctx, companyId) {
  const config = await getResolvedConfig(ctx);
  const validation = validateConfig(config);
  const [companyStatus, counts, checkpoints, jobs] = await Promise.all([
    getCompanySyncStatus(ctx, companyId),
    listMappingCounts(ctx, companyId),
    getCompanyCheckpoint(ctx, companyId),
    Promise.resolve(listJobsForUi(ctx))
  ]);
  return {
    config,
    validation: {
      ok: validation.ok,
      warnings: validation.warnings ?? [],
      errors: validation.errors ?? []
    },
    companyId,
    companyStatus,
    counts,
    checkpoints,
    jobs
  };
}
async function ensureMigrationCandidateImported(ctx, companyId, candidate, config, client, sessionProvenanceCache) {
  const externalId = candidate.sourceType === "issue_comments" ? `paperclip:comment:${candidate.sourceId}` : candidate.sourceType === "issue_documents" ? `paperclip:document:${candidate.sourceId}` : candidate.workspaceId && candidate.metadata.relativePath ? fileExternalId(candidate.workspaceId, String(candidate.metadata.relativePath)) : candidate.sourceId;
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
        issue.identifier ?? null
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
        importedAt: (/* @__PURE__ */ new Date()).toISOString(),
        metadata: candidate.metadata
      });
      return { imported: false, skipped: true };
    }
    const actor = {
      authorType: candidate.authorType,
      authorId: candidate.authorId
    };
    await ensureActorPeer(ctx, companyId, actor, client);
    await ensureActorPeerMapping(ctx, companyId, actor);
    await client.appendMessages(companyId, issue.id, [{
      content: candidate.content,
      peerId: await resolvePeerIdFromActor(ctx, companyId, actor),
      createdAt: candidate.createdAt,
      metadata: candidate.metadata
    }]);
    await upsertImportLedger(ctx, companyId, {
      sourceType: candidate.sourceType === "issue_comments" ? "issue_comment" : candidate.sourceType === "issue_documents" ? "issue_document" : "run_transcript",
      externalId,
      fingerprint: candidate.fingerprint,
      issueId: candidate.issueId,
      issueIdentifier: candidate.issueIdentifier,
      importedAt: (/* @__PURE__ */ new Date()).toISOString(),
      metadata: candidate.metadata
    });
    if (candidateProvenanceKey) {
      existingSessionProvenance.add(candidateProvenanceKey);
    }
  } else {
    const isGuidance = candidate.sourceType === "workspace_guidance_files";
    const isAgentProfile = candidate.sourceType === "agent_profile_files";
    const agentProfileId = isAgentProfile && typeof candidate.metadata.authorId === "string" ? String(candidate.metadata.authorId).replace(/^agent:/, "") : null;
    const agentProfile = agentProfileId ? await ctx.agents.get(agentProfileId, companyId) : null;
    const peerId = isGuidance ? systemPeerId() : agentProfile ? peerIdForAgent(agentProfile.id, agentProfile.name) : ownerPeerIdForCompany(companyId);
    if (isGuidance) {
      await client.ensurePeer(companyId, peerId, {
        company_id: companyId,
        system_id: "paperclip"
      });
      await upsertSystemPeerMapping(ctx, companyId);
    } else if (agentProfile) {
      await client.ensureAgentPeer(companyId, agentProfile);
      await upsertAgentPeerMapping(ctx, companyId, agentProfile);
    } else {
      await client.ensurePeer(companyId, peerId, {
        company_id: companyId,
        owner_id: companyId
      });
      await upsertOwnerPeerMapping(ctx, companyId);
    }
    const sessionId = agentProfileId ? bootstrapSessionIdForAgent(agentProfileId) : bootstrapSessionIdForCompany(companyId);
    await client.ensureRawSession(companyId, sessionId, {
      source_system: "paperclip",
      company_id: companyId,
      session_role: isAgentProfile ? "agent_profile" : "bootstrap"
    });
    await upsertBootstrapSessionMapping(ctx, companyId, {
      kind: isAgentProfile ? "agent" : "company",
      agentId: agentProfileId ?? void 0,
      title: isGuidance ? "Workspace Guidance" : "Legacy Memory",
      workspaceId
    });
    await upsertFileImportSource(ctx, companyId, {
      workspaceId: candidate.workspaceId ?? workspaceId,
      projectId: candidate.projectId ?? "unknown",
      relativePath: String(candidate.metadata.relativePath ?? candidate.title),
      sourceCategory: String(candidate.sourceCategory ?? "legacy-user-memory")
    });
    await client.appendMessagesToSession(companyId, sessionId, [{
      content: candidate.content,
      peerId,
      createdAt: candidate.createdAt,
      metadata: candidate.metadata
    }]);
    await upsertImportLedger(ctx, companyId, {
      sourceType: isGuidance ? "workspace_guidance_file" : isAgentProfile ? "agent_profile_file" : "legacy_memory_file",
      externalId,
      fingerprint: candidate.fingerprint,
      issueId: candidate.issueId ?? sessionId,
      issueIdentifier: candidate.issueIdentifier,
      importedAt: (/* @__PURE__ */ new Date()).toISOString(),
      metadata: candidate.metadata
    });
  }
  return { imported: true, skipped: false };
}
async function scanMigrationSources(ctx, companyId) {
  await patchCompanySyncStatus(ctx, companyId, {
    migrationStatus: "scanned",
    lastError: null
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
    lastError: null
  });
  try {
    const preview = buildMigrationPreview(companyId, await loadMigrationCandidates(ctx, companyId));
    await patchCompanySyncStatus(ctx, companyId, {
      migrationStatus: "preview_ready",
      latestMigrationPreview: preview,
      lastError: null
    });
    await upsertMigrationReport(ctx, companyId, "preview", buildMigrationReportPayload(companyId, preview));
    await patchJobProgress(ctx, companyId, {
      activeJobKey: "migration-scan",
      status: "complete",
      processed: preview.estimatedMessages,
      succeeded: preview.estimatedMessages,
      currentSourceType: null,
      currentEntityId: null
    });
    return preview;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await patchCompanySyncStatus(ctx, companyId, {
      migrationStatus: "failed",
      lastError: buildSyncErrorSummary({ message }),
      pendingFailureCount: (await getCompanySyncStatus(ctx, companyId)).pendingFailureCount + 1
    });
    await patchJobProgress(ctx, companyId, {
      activeJobKey: "migration-scan",
      status: "failed",
      lastError: message
    });
    throw error;
  }
}
async function importMigrationPreview(ctx, companyId) {
  const config = await getResolvedConfig(ctx);
  const validation = validateConfig(config);
  if (!validation.ok) {
    throw new Error(validation.errors?.join("; ") ?? "Honcho config is invalid");
  }
  const preview = (await getCompanySyncStatus(ctx, companyId)).latestMigrationPreview ?? await scanMigrationSources(ctx, companyId);
  const candidates = await loadMigrationCandidates(ctx, companyId);
  const client = await createHonchoClient({ ctx, config });
  const sessionProvenanceCache = /* @__PURE__ */ new Map();
  let processed = 0;
  let succeeded = 0;
  let skipped = 0;
  let failed = 0;
  let firstError = null;
  await patchCompanySyncStatus(ctx, companyId, {
    migrationStatus: "running",
    lastError: null
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
    lastError: null
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
      currentEntityId: candidate.sourceId
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
      commentsImported: await listMappingCounts(ctx, companyId).then((counts2) => counts2.importedComments),
      documentsImported: await listMappingCounts(ctx, companyId).then((counts2) => counts2.importedDocuments),
      skipped,
      failed
    },
    completedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await upsertMigrationReport(ctx, companyId, "import", report);
  const counts = await listMappingCounts(ctx, companyId);
  await patchCompanySyncStatus(ctx, companyId, {
    connectionStatus: "connected",
    migrationStatus: failed > 0 ? "partial" : "complete",
    lastSuccessfulSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
    lastError: firstError ? buildSyncErrorSummary({ message: firstError }) : null,
    pendingFailureCount: failed > 0 ? (await getCompanySyncStatus(ctx, companyId)).pendingFailureCount + 1 : 0
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
    lastError: firstError
  });
  return counts;
}
async function initializeMemory(ctx, companyId) {
  const config = await getResolvedConfig(ctx);
  const validation = validateConfig(config);
  if (!validation.ok) {
    await patchCompanySyncStatus(ctx, companyId, {
      connectionStatus: "auth_failed",
      initializationStatus: "failed",
      promptContextStatus: "inactive",
      pendingFailureCount: (await getCompanySyncStatus(ctx, companyId)).pendingFailureCount + 1,
      lastError: buildSyncErrorSummary({
        message: validation.errors?.join("; ") ?? "Honcho config is invalid"
      })
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
    lastError: null
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
    lastError: null
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
    const report = {
      companyId,
      workspace: {
        id: workspaceId,
        status: countsBefore.mappedSessions > 0 ? "existing" : "created"
      },
      peers: {
        mapped: counts.mappedPeers,
        status: counts.mappedPeers > 0 ? "complete" : "partial"
      },
      importSummary: {
        comments: counts.importedComments,
        documents: counts.importedDocuments,
        skipped: 0,
        failed: 0
      },
      promptContext: {
        status: probe.status,
        preview: probe.preview
      },
      completedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await upsertMigrationReport(ctx, companyId, "initialization", report);
    await patchCompanySyncStatus(ctx, companyId, {
      connectionStatus: "connected",
      workspaceStatus: "created",
      peerStatus: counts.mappedPeers > 0 ? "complete" : "partial",
      initializationStatus: "complete",
      migrationStatus: "complete",
      promptContextStatus: probe.status,
      lastSuccessfulSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
      lastError: null,
      pendingFailureCount: 0,
      lastInitializationReport: report
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
      lastError: null
    });
    return report;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await patchCompanySyncStatus(ctx, companyId, {
      connectionStatus: message.includes("secret ref") ? "auth_failed" : "connected",
      initializationStatus: "failed",
      promptContextStatus: "inactive",
      pendingFailureCount: (await getCompanySyncStatus(ctx, companyId)).pendingFailureCount + 1,
      lastError: buildSyncErrorSummary({ message })
    });
    await patchJobProgress(ctx, companyId, {
      activeJobKey: "initialize-memory",
      status: "failed",
      lastError: message
    });
    throw error;
  }
}
async function syncIssue(ctx, issueId, companyId, options = {}) {
  return await runIssueSyncExclusive(companyId, issueId, async () => {
    const config = await getResolvedConfig(ctx);
    const status = await getIssueSyncStatus(ctx, issueId);
    const replay = options.replay === true;
    const resources = await fetchIssueResources(ctx, issueId, companyId, config);
    const client = await createHonchoClient({ ctx, config });
    await patchIssueSyncStatus(ctx, issueId, {
      replayInProgress: replay,
      replayRequestedAt: replay ? (/* @__PURE__ */ new Date()).toISOString() : status.replayRequestedAt
    });
    try {
      await ensureIssueTopology(ctx, resources, client, config);
      const commentMessages = config.syncIssueComments ? await buildCommentMessages(ctx, resources.issue, resources.comments, config, replay, replay ? null : status.lastSyncedCommentId) : [];
      const documentMessages = config.syncIssueDocuments ? await buildDocumentMessages(ctx, resources.issue, resources.documents, config, replay ? null : status.lastSyncedDocumentRevisionId) : [];
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
        lastBackfillAt: (/* @__PURE__ */ new Date()).toISOString(),
        replayInProgress: false,
        lastError: null,
        latestAppendAt: allMessages.length > 0 ? (/* @__PURE__ */ new Date()).toISOString() : status.latestAppendAt,
        latestContextPreview: context.preview,
        latestContextFetchedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      await patchCompanySyncStatus(ctx, companyId, {
        connectionStatus: "connected",
        workspaceStatus: "mapped",
        peerStatus: "partial",
        lastSuccessfulSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
        lastError: null
      });
      return {
        issueId: resources.issue.id,
        issueIdentifier: resources.issue.identifier ?? null,
        syncedComments: commentMessages.length,
        syncedDocumentSections: documentMessages.length,
        syncedRuns: 0,
        lastSyncedCommentId: lastComment?.id ?? null,
        lastSyncedRunId: null,
        replayed: replay
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
          documentKey: options.documentKeyHint ?? null
        })
      });
      await patchIssueSyncStatus(ctx, issueId, {
        replayInProgress: false,
        lastError: buildSyncErrorSummary({
          message,
          issueId,
          commentId: options.commentIdHint ?? null,
          documentKey: options.documentKeyHint ?? null
        })
      });
      throw error;
    }
  });
}
async function replayIssue(ctx, issueId, companyId) {
  await clearIssueSyncStatus(ctx, issueId);
  return await syncIssue(ctx, issueId, companyId, { replay: true });
}
async function loadIssueStatusData(ctx, issueId, companyId) {
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
      observe_others: config.observe_others
    }
  };
}
async function loadMemoryStatusData(ctx, companyId) {
  return await buildMemoryStatusData(ctx, companyId);
}
async function loadMigrationPreviewData(ctx, companyId) {
  const companyStatus = await getCompanySyncStatus(ctx, companyId);
  return companyStatus.latestMigrationPreview;
}
async function loadMigrationJobStatusData(ctx, companyId) {
  return {
    companyId,
    checkpoint: await getCompanyCheckpoint(ctx, companyId)
  };
}
async function probePromptContext(ctx, companyId, input) {
  const issueId = input?.issueId ?? (await listCompanyIssues(ctx, companyId))[0]?.id ?? null;
  const agentId = input?.agentId ?? (await listCompanyAgents(ctx, companyId))[0]?.id ?? null;
  if (!agentId) {
    await patchCompanySyncStatus(ctx, companyId, {
      promptContextStatus: "inactive"
    });
    return { status: "inactive", preview: null };
  }
  try {
    const result = await buildPromptContext(ctx, {
      companyId,
      issueId,
      agentId,
      runId: `probe:${companyId}:${issueId ?? "workspace"}:${agentId}`,
      prompt: input?.prompt ?? void 0
    });
    await patchCompanySyncStatus(ctx, companyId, {
      promptContextStatus: result ? "active" : "inactive",
      lastError: null
    });
    return {
      status: result ? "active" : "inactive",
      preview: result?.preview ?? null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const previous = await getCompanySyncStatus(ctx, companyId);
    await patchCompanySyncStatus(ctx, companyId, {
      promptContextStatus: "degraded",
      lastError: buildSyncErrorSummary({ message }),
      pendingFailureCount: previous.pendingFailureCount + 1
    });
    throw error;
  }
}
async function repairMappings(ctx, companyId) {
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
    lastError: null
  });
  return { repaired };
}
async function getIssueContext(ctx, issueId, companyId) {
  const issue = await ctx.issues.get(issueId, companyId);
  if (!issue) throw new Error("Issue not found");
  const company = await ctx.companies.get(companyId);
  const config = await getResolvedConfig(ctx);
  const context = await refreshContextPreview(ctx, issue, company, config);
  return {
    ...context,
    issueIdentifier: issue.identifier ?? null
  };
}
async function getSessionContext(ctx, issueId, companyId) {
  return await getIssueContext(ctx, issueId, companyId);
}
async function getWorkspaceContext(ctx, agentId, companyId, query) {
  const config = await getResolvedConfig(ctx);
  const client = await createHonchoClient({ ctx, config });
  return await client.getWorkspaceContext(companyId, agentId, query);
}
async function getAgentContext(ctx, companyId, agentId, issueId) {
  const config = await getResolvedConfig(ctx);
  const client = await createHonchoClient({ ctx, config });
  return await client.getPeerRepresentation(companyId, agentId, {
    issueId: issueId ?? null
  });
}
async function getHierarchyContext(_ctx, _companyId, _runId) {
  return null;
}
async function searchMemory(ctx, agentId, companyId, params) {
  const config = await getResolvedConfig(ctx);
  const client = await createHonchoClient({ ctx, config });
  const scope = params.scope ?? (params.issueId ? "session" : "workspace");
  return await client.searchMemory(companyId, agentId, {
    ...params,
    scope,
    limit: params.limit ?? DEFAULT_SEARCH_LIMIT
  });
}
async function buildPromptContext(ctx, input) {
  const config = await getResolvedConfig(ctx);
  if (!config.enablePromptContext) return null;
  if (!validateConfig(config).ok) return null;
  const client = await createHonchoClient({ ctx, config });
  const [company, issue, agent] = await Promise.all([
    ctx.companies.get(input.companyId),
    input.issueId ? ctx.issues.get(input.issueId, input.companyId) : Promise.resolve(null),
    ctx.agents.get(input.agentId, input.companyId)
  ]);
  if (agent) {
    await client.ensureAgentPeer(input.companyId, agent);
  }
  const query = input.prompt ?? issue?.title ?? company?.name ?? agent?.name ?? "recent company memory";
  const sections = [];
  if (issue) {
    await syncIssue(ctx, issue.id, input.companyId, { replay: false });
    const issueContext = await getIssueContext(ctx, issue.id, input.companyId);
    if (issueContext.preview) {
      sections.push(`Task session memory for ${issue.identifier ?? issue.id}:
${issueContext.preview}`);
    }
  }
  const peerRepresentation = await client.getPeerRepresentation(input.companyId, input.agentId, {
    issueId: issue?.id ?? null
  }).catch(() => null);
  if (peerRepresentation) {
    sections.push(`Active employee peer memory:
${peerRepresentation}`);
  }
  const workspaceResults = await searchMemory(ctx, input.agentId, input.companyId, {
    query,
    scope: "workspace",
    limit: 3
  }).catch(() => []);
  const workspacePreview = formatSearchResults(workspaceResults);
  if (workspacePreview) {
    sections.push(`Company workspace recall:
${workspacePreview}`);
  }
  const hierarchyPreview = await getHierarchyContext(ctx, input.companyId, input.runId).catch(() => null);
  if (hierarchyPreview) {
    sections.push(`Delegated child memory:
${hierarchyPreview}`);
    if (issue) {
      await patchIssueSyncStatus(ctx, issue.id, {
        latestHierarchyContextPreview: hierarchyPreview
      });
    }
  }
  if (sections.length === 0) return null;
  const prompt = sections.join("\n\n");
  const preview = prompt.length > 1500 ? `${prompt.slice(0, 1500)}...` : prompt;
  if (issue) {
    await patchIssueSyncStatus(ctx, issue.id, {
      latestPromptContextPreview: preview,
      latestPromptContextBuiltAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  return {
    prompt,
    preview,
    metadata: {
      companyId: input.companyId,
      issueId: issue?.id ?? null,
      agentId: input.agentId
    }
  };
}

// src/worker.ts
function requireString(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}
function inferIssueId(params, runCtx) {
  if (typeof params.issueId === "string" && params.issueId.trim()) return params.issueId.trim();
  return null;
}
var plugin = definePlugin({
  async setup(ctx) {
    const initialConfig = await getResolvedConfig(ctx);
    for (const launcher of RUNTIME_LAUNCHERS) {
      ctx.launchers.register(launcher);
    }
    ctx.data.register(DATA_KEYS.memoryStatus, async (params) => {
      const companyId = typeof params.companyId === "string" && params.companyId.trim() ? params.companyId.trim() : null;
      if (!companyId) {
        throw new Error("companyId is required");
      }
      return await loadMemoryStatusData(ctx, companyId);
    });
    ctx.data.register(DATA_KEYS.migrationPreview, async (params) => {
      const companyId = requireString(params.companyId, "companyId");
      return await loadMigrationPreviewData(ctx, companyId);
    });
    ctx.data.register(DATA_KEYS.migrationJobStatus, async (params) => {
      const companyId = requireString(params.companyId, "companyId");
      return await loadMigrationJobStatusData(ctx, companyId);
    });
    ctx.data.register(DATA_KEYS.issueStatus, async (params) => {
      const issueId = requireString(params.issueId, "issueId");
      const companyId = requireString(params.companyId, "companyId");
      return await loadIssueStatusData(ctx, issueId, companyId);
    });
    ctx.actions.register(ACTION_KEYS.testConnection, async () => {
      const config = await getResolvedConfig(ctx);
      const validation = validateConfig(config);
      if (!validation.ok) {
        throw new Error(validation.errors?.join("; ") ?? "Honcho config is invalid");
      }
      const companyId = (await ctx.companies.list({ limit: 1, offset: 0 }))[0]?.id ?? null;
      const company = companyId ? await ctx.companies.get(companyId) : null;
      const client = await createHonchoClient({ ctx, config });
      const { workspaceId } = await client.probeConnection(companyId ?? void 0, company);
      return {
        ok: true,
        workspaceId,
        at: (/* @__PURE__ */ new Date()).toISOString()
      };
    });
    ctx.actions.register(ACTION_KEYS.resyncIssue, async (params) => {
      const issueId = requireString(params.issueId, "issueId");
      const companyId = requireString(params.companyId, "companyId");
      return await replayIssue(ctx, issueId, companyId);
    });
    ctx.actions.register(ACTION_KEYS.initializeMemoryForCompany, async (params) => {
      const companyId = requireString(params.companyId, "companyId");
      await setPreparedJobCompany(ctx, JOB_KEYS.initializeMemory, companyId);
      return { ok: true, companyId };
    });
    ctx.actions.register(ACTION_KEYS.probePromptContext, async (params) => {
      const companyId = requireString(params.companyId, "companyId");
      return await probePromptContext(ctx, companyId, {
        issueId: typeof params.issueId === "string" ? params.issueId : null,
        agentId: typeof params.agentId === "string" ? params.agentId : null,
        prompt: typeof params.prompt === "string" ? params.prompt : null
      });
    });
    ctx.jobs.register(JOB_KEYS.initializeMemory, async () => {
      const companyId = await consumePreparedJobCompany(ctx, JOB_KEYS.initializeMemory) ?? (await ctx.companies.list({ limit: 1, offset: 0 }))[0]?.id;
      if (!companyId) throw new Error("No company available to initialize memory");
      await initializeMemory(ctx, companyId);
    });
    ctx.jobs.register(JOB_KEYS.migrationScan, async () => {
      const companies = await ctx.companies.list({ limit: 1, offset: 0 });
      const companyId = companies[0]?.id;
      if (!companyId) throw new Error("No company available to scan migration sources");
      await scanMigrationSources(ctx, companyId);
    });
    ctx.jobs.register(JOB_KEYS.migrationImport, async () => {
      const companies = await ctx.companies.list({ limit: 1, offset: 0 });
      const companyId = companies[0]?.id;
      if (!companyId) throw new Error("No company available to import migration sources");
      await importMigrationPreview(ctx, companyId);
    });
    ctx.events.on("issue.created", async (event) => {
      try {
        if (!event.entityId) return;
        await syncIssue(ctx, event.entityId, event.companyId, { replay: false });
      } catch (error) {
        ctx.logger.warn("Honcho sync on issue.created failed", {
          issueId: event.entityId,
          companyId: event.companyId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
    ctx.events.on("issue.comment.created", async (event) => {
      try {
        if (!event.entityId) return;
        const payload = typeof event.payload === "object" && event.payload !== null ? event.payload : {};
        await syncIssue(ctx, event.entityId, event.companyId, {
          replay: false,
          commentIdHint: typeof payload.commentId === "string" ? payload.commentId : null
        });
      } catch (error) {
        ctx.logger.warn("Honcho sync on issue.comment.created failed", {
          issueId: event.entityId,
          companyId: event.companyId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
    ctx.events.on("issue.updated", async (event) => {
      try {
        const config = await getResolvedConfig(ctx);
        if (!config.syncIssueDocuments || !event.entityId) return;
        await syncIssue(ctx, event.entityId, event.companyId, {
          replay: false,
          documentKeyHint: null
        });
      } catch (error) {
        ctx.logger.warn("Honcho sync on issue.updated failed", {
          issueId: event.entityId,
          companyId: event.companyId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
    ctx.tools.register(
      TOOL_NAMES.getIssueContext,
      manifest_default.tools?.find((tool) => tool.name === TOOL_NAMES.getIssueContext) ?? {
        displayName: "Honcho Issue Context",
        description: "Retrieve Honcho context for an issue.",
        parametersSchema: { type: "object", properties: {} }
      },
      async (params, runCtx) => {
        const issueId = inferIssueId(params, runCtx);
        if (!issueId) return { error: "issueId is required" };
        const context = await getIssueContext(ctx, issueId, runCtx.companyId);
        return {
          content: context.preview ?? "No Honcho context available for this issue yet.",
          data: context
        };
      }
    );
    ctx.tools.register(
      TOOL_NAMES.searchMemory,
      manifest_default.tools?.find((tool) => tool.name === TOOL_NAMES.searchMemory) ?? {
        displayName: "Honcho Search Memory",
        description: "Search Honcho memory",
        parametersSchema: { type: "object", properties: {} }
      },
      async (params, runCtx) => {
        const input = params;
        const query = requireString(input.query, "query");
        const issueId = inferIssueId(input, runCtx);
        const scope = input.scope === "workspace" ? "workspace" : "session";
        const limit = typeof input.limit === "number" && Number.isFinite(input.limit) ? Math.max(1, Math.min(10, Math.floor(input.limit))) : DEFAULT_SEARCH_LIMIT;
        const results = await searchMemory(ctx, runCtx.agentId, runCtx.companyId, {
          query,
          issueId: issueId ?? void 0,
          scope: issueId ? scope : "workspace",
          limit
        });
        const content = results.length > 0 ? results.map((result, index) => `Result ${index + 1}: ${result.content ?? "(no content)"}`).join("\n\n") : "No Honcho memory results found.";
        return {
          content,
          data: {
            query,
            issueId,
            scope: issueId ? scope : "workspace",
            results
          }
        };
      }
    );
    if (initialConfig.enablePeerChat) {
      ctx.tools.register(
        TOOL_NAMES.askPeer,
        manifest_default.tools?.find((tool) => tool.name === TOOL_NAMES.askPeer) ?? {
          displayName: "Honcho Ask Peer",
          description: "Ask a Honcho peer",
          parametersSchema: { type: "object", properties: {} }
        },
        async (params, runCtx) => {
          const config = await getResolvedConfig(ctx);
          if (!config.enablePeerChat) {
            return { error: "Honcho peer chat is disabled in plugin config" };
          }
          assertConfigured(config);
          const input = params;
          const targetPeerId = requireString(input.targetPeerId, "targetPeerId");
          const query = requireString(input.query, "query");
          const issueId = inferIssueId(input, runCtx) ?? void 0;
          const client = await createHonchoClient({ ctx, config });
          const response = await client.askPeer(runCtx.companyId, runCtx.agentId, {
            targetPeerId,
            query,
            issueId
          });
          const content = response.text ?? response.response ?? response.messages?.map((message) => message.content).filter(Boolean).join("\n\n") ?? "No Honcho peer response returned.";
          return {
            content,
            data: response
          };
        }
      );
    }
    ctx.tools.register(
      TOOL_NAMES.getWorkspaceContext,
      manifest_default.tools?.find((tool) => tool.name === TOOL_NAMES.getWorkspaceContext) ?? {
        displayName: "Honcho Workspace Context",
        description: "Retrieve Honcho workspace context",
        parametersSchema: { type: "object", properties: {} }
      },
      async (params, runCtx) => {
        const input = params;
        const query = typeof input.query === "string" && input.query.trim() ? input.query.trim() : "recent workspace memory";
        const results = await getWorkspaceContext(ctx, runCtx.agentId, runCtx.companyId, query);
        return {
          content: results.map((result) => result.content).filter(Boolean).join("\n\n") || "No workspace context found.",
          data: results
        };
      }
    );
    ctx.tools.register(
      TOOL_NAMES.searchMessages,
      manifest_default.tools?.find((tool) => tool.name === TOOL_NAMES.searchMessages) ?? {
        displayName: "Honcho Search Messages",
        description: "Search raw Honcho messages",
        parametersSchema: { type: "object", properties: {} }
      },
      async (params, runCtx) => {
        const input = params;
        const query = requireString(input.query, "query");
        const issueId = inferIssueId(input, runCtx);
        const results = await searchMemory(ctx, runCtx.agentId, runCtx.companyId, {
          query,
          issueId: issueId ?? void 0,
          scope: issueId ? "session" : "workspace",
          limit: typeof input.limit === "number" ? input.limit : DEFAULT_SEARCH_LIMIT
        });
        return {
          content: results.map((result) => result.content).filter(Boolean).join("\n\n") || "No messages found.",
          data: results
        };
      }
    );
    ctx.tools.register(
      TOOL_NAMES.searchConclusions,
      manifest_default.tools?.find((tool) => tool.name === TOOL_NAMES.searchConclusions) ?? {
        displayName: "Honcho Search Conclusions",
        description: "Search summarized Honcho memory",
        parametersSchema: { type: "object", properties: {} }
      },
      async (params, runCtx) => {
        const input = params;
        const query = requireString(input.query, "query");
        const issueId = inferIssueId(input, runCtx);
        const results = await searchMemory(ctx, runCtx.agentId, runCtx.companyId, {
          query,
          issueId: issueId ?? void 0,
          scope: issueId ? "session" : "workspace",
          limit: typeof input.limit === "number" ? input.limit : DEFAULT_SEARCH_LIMIT,
          summaryOnly: true
        });
        return {
          content: results.map((result) => result.content).filter(Boolean).join("\n\n") || "No conclusions found.",
          data: results
        };
      }
    );
    ctx.tools.register(
      TOOL_NAMES.getSession,
      manifest_default.tools?.find((tool) => tool.name === TOOL_NAMES.getSession) ?? {
        displayName: "Honcho Session",
        description: "Retrieve session context",
        parametersSchema: { type: "object", properties: {} }
      },
      async (params, runCtx) => {
        const issueId = inferIssueId(params, runCtx);
        if (!issueId) return { error: "issueId is required" };
        const context = await getSessionContext(ctx, issueId, runCtx.companyId);
        return {
          content: context.preview ?? "No session context available.",
          data: context
        };
      }
    );
    ctx.tools.register(
      TOOL_NAMES.getAgentContext,
      manifest_default.tools?.find((tool) => tool.name === TOOL_NAMES.getAgentContext) ?? {
        displayName: "Honcho Agent Context",
        description: "Retrieve agent peer context",
        parametersSchema: { type: "object", properties: {} }
      },
      async (params, runCtx) => {
        const input = params;
        const agentId = requireString(input.agentId ?? runCtx.agentId, "agentId");
        const issueId = inferIssueId(input, runCtx);
        const content = await getAgentContext(ctx, runCtx.companyId, agentId, issueId);
        return {
          content: content ?? "No agent context available.",
          data: { agentId, issueId, content }
        };
      }
    );
    ctx.tools.register(
      TOOL_NAMES.getHierarchyContext,
      manifest_default.tools?.find((tool) => tool.name === TOOL_NAMES.getHierarchyContext) ?? {
        displayName: "Honcho Hierarchy Context",
        description: "Retrieve hierarchy context",
        parametersSchema: { type: "object", properties: {} }
      },
      async (params, runCtx) => {
        const input = params;
        const runId = typeof input.runId === "string" && input.runId.trim().length > 0 ? input.runId.trim() : typeof runCtx.runId === "string" && runCtx.runId.trim().length > 0 ? runCtx.runId.trim() : null;
        const content = runId ? await getHierarchyContext(ctx, runCtx.companyId, runId) : null;
        return {
          content: content ?? "Hierarchy context unavailable on this host.",
          data: { runId, content }
        };
      }
    );
  },
  async onHealth() {
    return { status: "ok", message: "Honcho worker is running" };
  },
  async onValidateConfig(config) {
    return validateConfig(config);
  }
});
var worker_default = plugin;
runWorker(plugin, import.meta.url);
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
