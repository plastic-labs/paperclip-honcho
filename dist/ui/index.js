// src/ui/index.tsx
import {
  usePluginAction,
  usePluginData
} from "@paperclipai/plugin-sdk/ui";
import { useEffect, useMemo, useState } from "react";

// src/constants.ts
var PLUGIN_ID = "honcho-ai.paperclip-honcho";
var DEFAULT_WORKSPACE_PREFIX = "paperclip";
var HONCHO_V3_PATH = "/v3";
var HONCHO_CONNECTION_PROBE_PATH = `${HONCHO_V3_PATH}/workspaces`;
var DEFAULT_MAX_WORKSPACE_FILE_BYTES = 64 * 1024;
var DEFAULT_JOB_WAIT_TIMEOUT_MS = 15 * 60 * 1e3;
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

// src/ui/settings-config.ts
function normalizeSettingsConfig(configJson) {
  const source = configJson ?? {};
  return {
    honchoApiBaseUrl: typeof source.honchoApiBaseUrl === "string" ? source.honchoApiBaseUrl.trim() : DEFAULT_CONFIG.honchoApiBaseUrl,
    honchoApiKey: typeof source.honchoApiKey === "string" ? source.honchoApiKey.trim() : typeof source.honchoApiKeySecretRef === "string" ? source.honchoApiKeySecretRef.trim() : DEFAULT_CONFIG.honchoApiKey,
    workspacePrefix: typeof source.workspacePrefix === "string" ? source.workspacePrefix : DEFAULT_CONFIG.workspacePrefix,
    syncIssueComments: typeof source.syncIssueComments === "boolean" ? source.syncIssueComments : DEFAULT_CONFIG.syncIssueComments,
    syncIssueDocuments: typeof source.syncIssueDocuments === "boolean" ? source.syncIssueDocuments : DEFAULT_CONFIG.syncIssueDocuments,
    enablePromptContext: typeof source.enablePromptContext === "boolean" ? source.enablePromptContext : DEFAULT_CONFIG.enablePromptContext,
    enablePeerChat: typeof source.enablePeerChat === "boolean" ? source.enablePeerChat : DEFAULT_CONFIG.enablePeerChat,
    observe_me: typeof source.observe_me === "boolean" ? source.observe_me : typeof source.observeMe === "boolean" ? source.observeMe : typeof source.observeAgentPeers === "boolean" ? source.observeAgentPeers : DEFAULT_CONFIG.observe_me,
    observe_others: typeof source.observe_others === "boolean" ? source.observe_others : typeof source.observeOthers === "boolean" ? source.observeOthers : typeof source.observeAgentPeers === "boolean" ? source.observeAgentPeers : DEFAULT_CONFIG.observe_others,
    noisePatterns: Array.isArray(source.noisePatterns) ? source.noisePatterns.filter((value) => typeof value === "string") : [...DEFAULT_CONFIG.noisePatterns],
    disableDefaultNoisePatterns: typeof source.disableDefaultNoisePatterns === "boolean" ? source.disableDefaultNoisePatterns : DEFAULT_CONFIG.disableDefaultNoisePatterns,
    stripPlatformMetadata: typeof source.stripPlatformMetadata === "boolean" ? source.stripPlatformMetadata : DEFAULT_CONFIG.stripPlatformMetadata,
    flushBeforeReset: typeof source.flushBeforeReset === "boolean" ? source.flushBeforeReset : DEFAULT_CONFIG.flushBeforeReset
  };
}
function getDeploymentMode(config) {
  return isHonchoCloudBaseUrl(config.honchoApiBaseUrl) ? "cloud" : "self-hosted";
}

// src/ui/index.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var sectionStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1rem"
};
var cardStyle = {
  border: "1px solid rgba(148, 163, 184, 0.35)",
  borderRadius: "14px",
  padding: "1rem",
  display: "grid",
  gap: "0.75rem",
  background: "rgba(15, 23, 42, 0.03)"
};
var heroStyle = {
  ...cardStyle,
  background: "linear-gradient(135deg, rgba(14, 116, 144, 0.09), rgba(15, 23, 42, 0.03))"
};
var buttonStyle = {
  width: "fit-content",
  border: "1px solid rgba(15, 23, 42, 0.15)",
  borderRadius: "999px",
  padding: "0.55rem 0.9rem",
  background: "white",
  color: "#0f172a",
  cursor: "pointer"
};
var primaryButtonStyle = {
  ...buttonStyle,
  background: "#0f172a",
  color: "white"
};
var inputStyle = {
  width: "100%",
  border: "1px solid rgba(15, 23, 42, 0.12)",
  borderRadius: "10px",
  padding: "0.7rem 0.8rem",
  fontSize: "0.92rem",
  background: "white",
  color: "#0f172a",
  WebkitTextFillColor: "#0f172a"
};
var selectStyle = {
  ...inputStyle,
  appearance: "none"
};
var labelStyle = {
  display: "grid",
  gap: "0.4rem",
  fontSize: "0.9rem"
};
var labelHeaderStyle = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  flexWrap: "wrap"
};
var optionalTagStyle = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "999px",
  padding: "0.1rem 0.5rem",
  fontSize: "0.72rem",
  fontWeight: 600,
  letterSpacing: "0.01em",
  background: "rgba(15, 23, 42, 0.06)",
  color: "#475569"
};
var gridStyle = {
  display: "grid",
  gap: "0.9rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
};
var statStyle = {
  ...cardStyle,
  gap: "0.35rem",
  padding: "0.85rem"
};
function hostFetchJson(path, init) {
  return fetch(path, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...init?.headers ?? {}
    },
    ...init
  }).then(async (response) => {
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Request failed: ${response.status}`);
    }
    return await response.json();
  });
}
function formatUnknownError(nextError) {
  if (nextError instanceof Error) return nextError.message;
  if (nextError && typeof nextError === "object") {
    const message = "message" in nextError ? nextError.message : void 0;
    if (typeof message === "string" && message.length > 0) return message;
    const error = "error" in nextError ? nextError.error : void 0;
    if (typeof error === "string" && error.length > 0) return error;
    try {
      return JSON.stringify(nextError);
    } catch {
      return String(nextError);
    }
  }
  return String(nextError);
}
function validateSettingsBeforePersist(config) {
  if (getDeploymentMode(config) === "self-hosted" && !config.honchoApiBaseUrl.trim()) {
    throw new Error("Honcho API base URL is required for self-hosted or local deployments.");
  }
}
function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
function useSettingsConfig() {
  const [configJson, setConfigJson] = useState({ ...DEFAULT_CONFIG });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    hostFetchJson(`/api/plugins/${PLUGIN_ID}/config`).then((result) => {
      if (cancelled) return;
      setConfigJson(normalizeSettingsConfig(result?.configJson));
      setError(null);
    }).catch((nextError) => {
      if (!cancelled) {
        setError(formatUnknownError(nextError));
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  async function save(nextConfig) {
    validateSettingsBeforePersist(nextConfig);
    setSaving(true);
    try {
      await hostFetchJson(`/api/plugins/${PLUGIN_ID}/config`, {
        method: "POST",
        body: JSON.stringify({ configJson: nextConfig })
      });
      setConfigJson(nextConfig);
      setError(null);
    } catch (nextError) {
      setError(formatUnknownError(nextError));
      throw nextError;
    } finally {
      setSaving(false);
    }
  }
  async function test(nextConfig) {
    return await hostFetchJson(`/api/plugins/${PLUGIN_ID}/config/test`, {
      method: "POST",
      body: JSON.stringify({ configJson: nextConfig })
    });
  }
  return {
    configJson,
    setConfigJson,
    loading,
    saving,
    error,
    save,
    test
  };
}
function useCompanySecrets(companyId) {
  const [secrets, setSecrets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const refresh = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const result = await hostFetchJson(`/api/companies/${companyId}/secrets`);
      setSecrets(result);
      setError(null);
    } catch (nextError) {
      setError(formatUnknownError(nextError));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, [companyId]);
  async function createSecret(input) {
    if (!companyId) throw new Error("companyId is required");
    setCreating(true);
    try {
      const created = await hostFetchJson(`/api/companies/${companyId}/secrets`, {
        method: "POST",
        body: JSON.stringify(input)
      });
      await refresh();
      return created;
    } finally {
      setCreating(false);
    }
  }
  return { secrets, loading, creating, error, refresh, createSecret };
}
function usePluginJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const refresh = async () => {
    setLoading(true);
    try {
      const result = await hostFetchJson(`/api/plugins/${PLUGIN_ID}/jobs`);
      setJobs(result);
      setError(null);
    } catch (nextError) {
      setError(formatUnknownError(nextError));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  async function triggerByKey(jobKey) {
    const job = jobs.find((entry) => entry.jobKey === jobKey);
    if (!job) {
      await refresh();
    }
    const resolved = jobs.find((entry) => entry.jobKey === jobKey);
    if (!resolved) throw new Error(`Job not found: ${jobKey}`);
    await hostFetchJson(`/api/plugins/${PLUGIN_ID}/jobs/${resolved.id}/trigger`, {
      method: "POST",
      body: JSON.stringify({})
    });
    await refresh();
  }
  return { jobs, loading, error, refresh, triggerByKey };
}
function useCompanies() {
  const [companies, setCompanies] = useState([]);
  useEffect(() => {
    void hostFetchJson("/api/companies").then((result) => setCompanies(result)).catch(() => setCompanies([]));
  }, []);
  return companies;
}
function Row({ label, value }) {
  return /* @__PURE__ */ jsxs("div", { style: { display: "grid", gridTemplateColumns: "180px 1fr", gap: "0.75rem", alignItems: "start" }, children: [
    /* @__PURE__ */ jsx("div", { style: { fontSize: "0.85rem", color: "#475569" }, children: label }),
    /* @__PURE__ */ jsx("div", { style: { fontSize: "0.92rem" }, children: value })
  ] });
}
function StatusPill({ label, tone = "neutral" }) {
  const palette = {
    neutral: { bg: "rgba(255,255,255,0.8)", fg: "#0f172a", border: "rgba(15,23,42,0.1)" },
    good: { bg: "rgba(16,185,129,0.12)", fg: "#047857", border: "rgba(16,185,129,0.25)" },
    warn: { bg: "rgba(245,158,11,0.12)", fg: "#b45309", border: "rgba(245,158,11,0.25)" },
    bad: { bg: "rgba(239,68,68,0.12)", fg: "#b91c1c", border: "rgba(239,68,68,0.25)" }
  }[tone];
  return /* @__PURE__ */ jsx("span", { style: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    borderRadius: "999px",
    padding: "0.25rem 0.65rem",
    fontSize: "0.82rem",
    border: `1px solid ${palette.border}`,
    background: palette.bg,
    color: palette.fg
  }, children: label });
}
function countTone(value, good = ["complete", "connected", "active", "mapped", "created"]) {
  if (!value) return "neutral";
  if (good.includes(value)) return "good";
  if (value.includes("fail") || value === "degraded") return "bad";
  if (value === "partial" || value === "preview_ready" || value === "running") return "warn";
  return "neutral";
}
function SecretSection(props) {
  const { secrets, refresh, createSecret, loading, creating, error } = useCompanySecrets(props.companyId);
  const deploymentMode = getDeploymentMode(props.config);
  const [draftOpen, setDraftOpen] = useState(false);
  const [customBaseUrlDraft, setCustomBaseUrlDraft] = useState(
    deploymentMode === "self-hosted" ? props.config.honchoApiBaseUrl : ""
  );
  const [draft, setDraft] = useState({
    name: "HONCHO_API_KEY",
    value: "",
    description: "Honcho API key for Paperclip memory activation"
  });
  useEffect(() => {
    if (deploymentMode === "self-hosted") {
      setCustomBaseUrlDraft(props.config.honchoApiBaseUrl);
    }
  }, [deploymentMode, props.config.honchoApiBaseUrl]);
  function updateDeploymentMode(nextMode) {
    if (nextMode === "cloud") {
      props.onConfigChange({ honchoApiBaseUrl: DEFAULT_CONFIG.honchoApiBaseUrl });
      return;
    }
    const nextBaseUrl = deploymentMode === "self-hosted" ? props.config.honchoApiBaseUrl : customBaseUrlDraft;
    props.onConfigChange({ honchoApiBaseUrl: nextBaseUrl });
  }
  return /* @__PURE__ */ jsxs("div", { style: cardStyle, children: [
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: "1rem", fontWeight: 600 }, children: "Connect Honcho" }),
      /* @__PURE__ */ jsx("div", { style: { color: "#475569", fontSize: "0.9rem" }, children: "Choose Honcho Cloud or a self-hosted/local deployment, then create or select a Paperclip secret that holds the Honcho API key." })
    ] }),
    /* @__PURE__ */ jsxs("label", { style: labelStyle, children: [
      /* @__PURE__ */ jsx("span", { style: labelHeaderStyle, children: "Deployment" }),
      /* @__PURE__ */ jsxs(
        "select",
        {
          value: deploymentMode,
          onChange: (event) => updateDeploymentMode(event.target.value),
          style: selectStyle,
          children: [
            /* @__PURE__ */ jsx("option", { value: "cloud", children: "Honcho Cloud" }),
            /* @__PURE__ */ jsx("option", { value: "self-hosted", children: "Self-hosted / local" })
          ]
        }
      )
    ] }),
    deploymentMode === "cloud" ? /* @__PURE__ */ jsxs("div", { style: { color: "#475569", fontSize: "0.9rem" }, children: [
      "Using the default Honcho Cloud base URL: `",
      DEFAULT_CONFIG.honchoApiBaseUrl,
      "`"
    ] }) : /* @__PURE__ */ jsxs("label", { style: labelStyle, children: [
      /* @__PURE__ */ jsx("span", { style: labelHeaderStyle, children: "Honcho API base URL" }),
      /* @__PURE__ */ jsx(
        "input",
        {
          value: props.config.honchoApiBaseUrl,
          onChange: (event) => {
            const nextBaseUrl = event.target.value;
            setCustomBaseUrlDraft(nextBaseUrl);
            props.onConfigChange({ honchoApiBaseUrl: nextBaseUrl });
          },
          style: inputStyle
        }
      ),
      /* @__PURE__ */ jsx("span", { style: { color: "#475569", fontSize: "0.82rem" }, children: "This URL must be reachable from the Paperclip host runtime. If Paperclip runs in Docker, `localhost` may not point at your machine." })
    ] }),
    /* @__PURE__ */ jsxs("label", { style: labelStyle, children: [
      /* @__PURE__ */ jsxs("span", { style: labelHeaderStyle, children: [
        /* @__PURE__ */ jsx("span", { children: "Honcho API Key" }),
        deploymentMode === "self-hosted" ? /* @__PURE__ */ jsx("span", { style: optionalTagStyle, children: "Optional" }) : null
      ] }),
      /* @__PURE__ */ jsxs(
        "select",
        {
          value: props.config.honchoApiKey,
          onChange: (event) => props.onConfigChange({ honchoApiKey: event.target.value }),
          style: selectStyle,
          children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "Select a Paperclip secret\u2026" }),
            secrets.map((secret) => /* @__PURE__ */ jsx("option", { value: secret.id, children: secret.name }, secret.id))
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: "0.65rem", flexWrap: "wrap" }, children: [
      /* @__PURE__ */ jsx("button", { style: buttonStyle, onClick: () => void refresh(), disabled: loading, children: "Refresh secrets" }),
      /* @__PURE__ */ jsx("button", { style: buttonStyle, onClick: () => setDraftOpen((value) => !value), children: draftOpen ? "Hide secret form" : "Create secret" })
    ] }),
    draftOpen ? /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "0.75rem" }, children: [
      /* @__PURE__ */ jsxs("label", { style: labelStyle, children: [
        /* @__PURE__ */ jsx("span", { children: "Secret name" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            value: draft.name,
            onChange: (event) => setDraft((current) => ({ ...current, name: event.target.value })),
            style: inputStyle
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("label", { style: labelStyle, children: [
        /* @__PURE__ */ jsx("span", { children: "Honcho API key value" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "password",
            value: draft.value,
            onChange: (event) => setDraft((current) => ({ ...current, value: event.target.value })),
            style: inputStyle
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("label", { style: labelStyle, children: [
        /* @__PURE__ */ jsx("span", { children: "Description" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            value: draft.description,
            onChange: (event) => setDraft((current) => ({ ...current, description: event.target.value })),
            style: inputStyle
          }
        )
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          style: buttonStyle,
          disabled: !props.companyId || !draft.value.trim() || creating,
          onClick: async () => {
            const created = await createSecret(draft);
            props.onConfigChange({ honchoApiKey: created.id });
            setDraft((current) => ({ ...current, value: "" }));
            setDraftOpen(false);
          },
          children: "Create and select secret"
        }
      )
    ] }) : null,
    error ? /* @__PURE__ */ jsx("div", { style: { color: "#b91c1c" }, children: error }) : null
  ] });
}
function SyncProfileSection(props) {
  const recommended = useMemo(() => ({
    syncIssueComments: true,
    syncIssueDocuments: true,
    enablePeerChat: true
  }), []);
  return /* @__PURE__ */ jsxs("div", { style: cardStyle, children: [
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: "1rem", fontWeight: 600 }, children: "Recommended sync profile" }),
      /* @__PURE__ */ jsx("div", { style: { color: "#475569", fontSize: "0.9rem" }, children: "The public-host-compatible package syncs issue comments and issue documents, then serves Honcho memory through tool-first workflows." })
    ] }),
    /* @__PURE__ */ jsx("button", { style: buttonStyle, onClick: () => props.onConfigChange(recommended), children: "Apply recommended profile" }),
    /* @__PURE__ */ jsx("div", { style: { display: "grid", gap: "0.55rem" }, children: [
      ["Sync issue comments", props.config.syncIssueComments, "syncIssueComments"],
      ["Sync issue documents", props.config.syncIssueDocuments, "syncIssueDocuments"],
      ["Enable peer chat tool", props.config.enablePeerChat, "enablePeerChat"],
      ["observe_me", props.config.observe_me, "observe_me"],
      ["observe_others", props.config.observe_others, "observe_others"]
    ].map(([label, checked, key]) => /* @__PURE__ */ jsxs("label", { style: { display: "flex", alignItems: "center", gap: "0.55rem" }, children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "checkbox",
          checked: Boolean(checked),
          onChange: (event) => props.onConfigChange({ [String(key)]: event.target.checked })
        }
      ),
      /* @__PURE__ */ jsx("span", { children: label })
    ] }, String(key))) }),
    /* @__PURE__ */ jsxs("label", { style: labelStyle, children: [
      /* @__PURE__ */ jsx("span", { children: "Workspace prefix" }),
      /* @__PURE__ */ jsx(
        "input",
        {
          value: props.config.workspacePrefix,
          onChange: (event) => props.onConfigChange({ workspacePrefix: event.target.value }),
          style: inputStyle
        }
      )
    ] })
  ] });
}
function StatsGrid({ status }) {
  if (!status) return null;
  const companyStatus = status.companyStatus;
  return /* @__PURE__ */ jsxs("div", { style: gridStyle, children: [
    /* @__PURE__ */ jsxs("div", { style: statStyle, children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: "0.82rem", color: "#475569" }, children: "Honcho connection" }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: "1.1rem", fontWeight: 600 }, children: companyStatus?.connectionStatus ?? "unknown" })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: statStyle, children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: "0.82rem", color: "#475569" }, children: "Mapped peers" }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: "1.1rem", fontWeight: 600 }, children: status.counts.mappedPeers })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: statStyle, children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: "0.82rem", color: "#475569" }, children: "Mapped sessions" }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: "1.1rem", fontWeight: 600 }, children: status.counts.mappedSessions })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: statStyle, children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: "0.82rem", color: "#475569" }, children: "Imported comments" }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: "1.1rem", fontWeight: 600 }, children: status.counts.importedComments })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: statStyle, children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: "0.82rem", color: "#475569" }, children: "Imported documents" }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: "1.1rem", fontWeight: 600 }, children: status.counts.importedDocuments })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: statStyle, children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: "0.82rem", color: "#475569" }, children: "Pending failures" }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: "1.1rem", fontWeight: 600 }, children: companyStatus?.pendingFailureCount ?? 0 })
    ] })
  ] });
}
function HonchoSettingsPage({ context }) {
  const companies = useCompanies();
  const companyId = context.companyId ?? companies[0]?.id ?? null;
  const settings = useSettingsConfig();
  const jobs = usePluginJobs();
  const memoryStatus = usePluginData(DATA_KEYS.memoryStatus, companyId ? { companyId } : {});
  const preview = usePluginData(DATA_KEYS.migrationPreview, companyId ? { companyId } : {});
  const jobStatus = usePluginData(DATA_KEYS.migrationJobStatus, companyId ? { companyId } : {});
  const testConnection = usePluginAction(ACTION_KEYS.testConnection);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [isActivating, setIsActivating] = useState(false);
  const [activationStepIndex, setActivationStepIndex] = useState(null);
  const [activationStepLabel, setActivationStepLabel] = useState(null);
  const status = memoryStatus.data;
  const companyStatus = status?.companyStatus;
  const deploymentMode = getDeploymentMode(settings.configJson);
  const canRunConnectionActions = deploymentMode === "cloud" ? Boolean(companyId && settings.configJson.honchoApiKey) : Boolean(companyId && settings.configJson.honchoApiBaseUrl.trim());
  const actionButtonsDisabled = settings.loading || settings.saving || jobs.loading || isActivating;
  function refreshActivationData() {
    memoryStatus.refresh();
    preview.refresh();
    jobStatus.refresh();
  }
  async function getCheckpointStatus() {
    if (!companyId) return null;
    const result = await hostFetchJson(`/api/plugins/${PLUGIN_ID}/data/${DATA_KEYS.migrationJobStatus}`, {
      method: "POST",
      body: JSON.stringify({
        companyId,
        params: { companyId }
      })
    });
    return result.data.checkpoint;
  }
  async function saveSettings() {
    setError(null);
    setNotice(null);
    try {
      await settings.save(settings.configJson);
      memoryStatus.refresh();
      setNotice("Settings saved.");
    } catch (nextError) {
      setNotice(null);
      setError(formatUnknownError(nextError));
      throw nextError;
    }
  }
  async function validateCurrentSettings() {
    validateSettingsBeforePersist(settings.configJson);
    const result = await settings.test(settings.configJson);
    if (!result.valid) {
      throw new Error(result.message ?? "Configuration is invalid.");
    }
  }
  async function triggerJob(jobKey) {
    await jobs.triggerByKey(jobKey);
    const timeoutAt = Date.now() + DEFAULT_JOB_WAIT_TIMEOUT_MS;
    while (Date.now() < timeoutAt) {
      const checkpoint = await getCheckpointStatus();
      if (checkpoint?.activeJobKey === jobKey && checkpoint.status === "failed") {
        throw new Error(checkpoint.lastError ?? `Job failed: ${jobKey}`);
      }
      if (checkpoint?.activeJobKey === jobKey && checkpoint.status === "complete") {
        refreshActivationData();
        return;
      }
      await sleep(1e3);
    }
    throw new Error(`Timed out waiting for ${jobKey} to complete.`);
  }
  async function runActivation() {
    const steps = [
      {
        label: "Validating config",
        errorLabel: "validating config",
        run: async () => {
          await validateCurrentSettings();
          await settings.save(settings.configJson);
        }
      },
      {
        label: "Testing connection",
        errorLabel: "testing connection",
        run: async () => {
          await testConnection({});
        }
      },
      {
        label: "Initializing memory",
        errorLabel: "initializing memory",
        run: async () => {
          await triggerJob(JOB_KEYS.initializeMemory);
        }
      }
    ];
    setError(null);
    setNotice(null);
    setIsActivating(true);
    try {
      for (const [index, step] of steps.entries()) {
        setActivationStepIndex(index);
        setActivationStepLabel(step.label);
        try {
          await step.run();
        } catch (nextError) {
          throw new Error(`Activation failed during ${step.errorLabel}: ${formatUnknownError(nextError)}`);
        }
      }
      refreshActivationData();
      setNotice("Honcho activation completed.");
    } catch (nextError) {
      setNotice(null);
      setError(formatUnknownError(nextError));
    } finally {
      setIsActivating(false);
      setActivationStepIndex(null);
      setActivationStepLabel(null);
    }
  }
  return /* @__PURE__ */ jsxs("div", { style: sectionStyle, children: [
    /* @__PURE__ */ jsxs("div", { style: heroStyle, children: [
      /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "0.4rem" }, children: [
        /* @__PURE__ */ jsx("div", { style: { fontSize: "1.35rem", fontWeight: 700 }, children: "Honcho Memory Activation" }),
        /* @__PURE__ */ jsx("div", { style: { color: "#475569", maxWidth: "70ch" }, children: "Connect Honcho, initialize memory for this company, and import issue comments and issue documents without leaving Paperclip." })
      ] }),
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: "0.5rem", flexWrap: "wrap" }, children: [
        /* @__PURE__ */ jsx(StatusPill, { label: `Connection: ${companyStatus?.connectionStatus ?? "unknown"}`, tone: countTone(companyStatus?.connectionStatus) }),
        /* @__PURE__ */ jsx(StatusPill, { label: `Initialization: ${companyStatus?.initializationStatus ?? "not_started"}`, tone: countTone(companyStatus?.initializationStatus) }),
        /* @__PURE__ */ jsx(StatusPill, { label: `Migration: ${companyStatus?.migrationStatus ?? "not_started"}`, tone: countTone(companyStatus?.migrationStatus) })
      ] })
    ] }),
    /* @__PURE__ */ jsx(
      SecretSection,
      {
        companyId,
        config: settings.configJson,
        onConfigChange: (next) => settings.setConfigJson((current) => ({ ...current, ...next }))
      }
    ),
    /* @__PURE__ */ jsx(
      SyncProfileSection,
      {
        config: settings.configJson,
        onConfigChange: (next) => settings.setConfigJson((current) => ({ ...current, ...next }))
      }
    ),
    /* @__PURE__ */ jsxs("div", { style: cardStyle, children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: "1rem", fontWeight: 600 }, children: "Company memory status" }),
      /* @__PURE__ */ jsx(StatsGrid, { status: status ?? null }),
      /* @__PURE__ */ jsx(Row, { label: "Company", value: context.companyId ?? "No company selected" }),
      !context.companyId && companies[0] ? /* @__PURE__ */ jsx(Row, { label: "Resolved company", value: `${companies[0].name} (${companies[0].issuePrefix ?? companies[0].id})` }) : null,
      /* @__PURE__ */ jsx(Row, { label: "Last successful sync", value: companyStatus?.lastSuccessfulSyncAt ?? "Not synced yet" }),
      /* @__PURE__ */ jsx(Row, { label: "Workspace status", value: companyStatus?.workspaceStatus ?? "unknown" }),
      /* @__PURE__ */ jsx(Row, { label: "Peer status", value: companyStatus?.peerStatus ?? "not_started" }),
      /* @__PURE__ */ jsx(Row, { label: "Checkpoint", value: jobStatus.data?.checkpoint?.status ?? "idle" }),
      /* @__PURE__ */ jsx(Row, { label: "Current job", value: jobStatus.data?.checkpoint?.activeJobKey ?? "None" }),
      /* @__PURE__ */ jsx(Row, { label: "Last initialization report", value: companyStatus?.lastInitializationReport ? "Available" : "None" }),
      /* @__PURE__ */ jsx(
        Row,
        {
          label: "Compatibility mode",
          value: "Tool-first memory is active. Run transcript import and legacy workspace file import require a newer Paperclip host."
        }
      ),
      companyStatus?.lastError ? /* @__PURE__ */ jsx("div", { style: { color: "#b91c1c" }, children: companyStatus.lastError.message }) : null
    ] }),
    /* @__PURE__ */ jsxs("div", { style: cardStyle, children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: "1rem", fontWeight: 600 }, children: "Migration preview" }),
      /* @__PURE__ */ jsx(Row, { label: "Source types", value: preview.data?.sourceTypes?.join(", ") ?? "Run a scan to generate preview" }),
      /* @__PURE__ */ jsx(Row, { label: "Issue comments", value: preview.data?.totals.comments ?? 0 }),
      /* @__PURE__ */ jsx(Row, { label: "Issue documents", value: preview.data?.totals.documents ?? 0 }),
      /* @__PURE__ */ jsx(Row, { label: "Legacy files", value: preview.data?.totals && typeof preview.data.totals.files === "number" ? preview.data.totals.files : 0 }),
      /* @__PURE__ */ jsx(Row, { label: "Estimated messages", value: preview.data?.estimatedMessages ?? 0 }),
      /* @__PURE__ */ jsx(Row, { label: "Warnings", value: preview.data?.warnings?.join("; ") || "None" })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: cardStyle, children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: "1rem", fontWeight: 600 }, children: "Activation" }),
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: "0.65rem", flexWrap: "wrap" }, children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            style: buttonStyle,
            disabled: actionButtonsDisabled,
            onClick: () => {
              void saveSettings().catch(() => void 0);
            },
            children: "Save settings"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            style: isActivating ? primaryButtonStyle : buttonStyle,
            disabled: actionButtonsDisabled || !canRunConnectionActions,
            onClick: () => {
              void runActivation();
            },
            children: isActivating ? `${activationStepLabel ?? "Initializing Honcho memory"}...` : "Initialize Honcho memory"
          }
        )
      ] }),
      isActivating && activationStepIndex !== null && activationStepLabel ? /* @__PURE__ */ jsx("div", { style: { color: "#475569" }, children: `Step ${activationStepIndex + 1} of 3: ${activationStepLabel}` }) : null,
      notice ? /* @__PURE__ */ jsx("div", { style: { color: "#0f766e" }, children: notice }) : null,
      error || settings.error || jobs.error ? /* @__PURE__ */ jsx("div", { style: { color: "#b91c1c" }, children: error ?? settings.error ?? jobs.error }) : null
    ] })
  ] });
}
function HonchoIssueMemoryTab({ context }) {
  const issueId = context.entityId;
  const companyId = context.companyId ?? "";
  const status = usePluginData(DATA_KEYS.issueStatus, {
    issueId,
    companyId
  });
  const resyncIssue = usePluginAction(ACTION_KEYS.resyncIssue);
  const issue = status.data;
  return /* @__PURE__ */ jsxs("div", { style: sectionStyle, children: [
    /* @__PURE__ */ jsxs("div", { style: heroStyle, children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: "1.2rem", fontWeight: 700 }, children: "Issue memory proof" }),
      /* @__PURE__ */ jsx("div", { style: { color: "#475569" }, children: "This tab stays intentionally small: sync markers, prompt-context previews, and a focused resync action for this issue." })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: cardStyle, children: [
      /* @__PURE__ */ jsx(Row, { label: "Issue", value: issue?.issueIdentifier ?? issueId }),
      /* @__PURE__ */ jsx(Row, { label: "Last synced comment", value: issue?.lastSyncedCommentId ?? "Not synced" }),
      /* @__PURE__ */ jsx(Row, { label: "Last synced document revision", value: issue?.lastSyncedDocumentRevisionId ?? "Not synced" }),
      /* @__PURE__ */ jsx(Row, { label: "Latest append", value: issue?.latestAppendAt ?? "No append yet" }),
      /* @__PURE__ */ jsx(Row, { label: "Latest prompt context build", value: issue?.latestPromptContextBuiltAt ?? "Not built" }),
      /* @__PURE__ */ jsx(Row, { label: "Latest context fetch", value: issue?.contextFetchedAt ?? "Not fetched" }),
      issue?.lastError ? /* @__PURE__ */ jsx("div", { style: { color: "#b91c1c" }, children: issue.lastError.message }) : null,
      /* @__PURE__ */ jsx(
        "button",
        {
          style: buttonStyle,
          onClick: () => void resyncIssue({ issueId, companyId }),
          disabled: !companyId,
          children: "Resync this issue"
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { style: cardStyle, children: [
      /* @__PURE__ */ jsx("div", { style: { fontWeight: 600 }, children: "Latest prompt context preview" }),
      /* @__PURE__ */ jsx("pre", { style: { whiteSpace: "pre-wrap", margin: 0 }, children: issue?.latestPromptContextPreview ?? "No prompt context preview available yet." })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: cardStyle, children: [
      /* @__PURE__ */ jsx("div", { style: { fontWeight: 600 }, children: "Latest session context preview" }),
      /* @__PURE__ */ jsx("pre", { style: { whiteSpace: "pre-wrap", margin: 0 }, children: issue?.contextPreview ?? "No session context preview available yet." })
    ] })
  ] });
}
function HonchoMemoryToolbarLauncher({ context }) {
  return /* @__PURE__ */ jsx(HonchoSettingsPage, { context });
}
export {
  HonchoIssueMemoryTab,
  HonchoMemoryToolbarLauncher,
  HonchoSettingsPage
};
//# sourceMappingURL=index.js.map
