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
  observeMe: true,
  observeOthers: true,
  noisePatterns: [],
  disableDefaultNoisePatterns: false,
  stripPlatformMetadata: true,
  flushBeforeReset: false
};

// src/ui/settings-config.ts
function normalizeSettingsConfig(configJson) {
  const source = configJson ?? {};
  return {
    honchoApiBaseUrl: typeof source.honchoApiBaseUrl === "string" ? source.honchoApiBaseUrl.trim() || DEFAULT_CONFIG.honchoApiBaseUrl : DEFAULT_CONFIG.honchoApiBaseUrl,
    honchoApiKeySecretRef: typeof source.honchoApiKeySecretRef === "string" ? source.honchoApiKeySecretRef : DEFAULT_CONFIG.honchoApiKeySecretRef,
    workspacePrefix: typeof source.workspacePrefix === "string" ? source.workspacePrefix : DEFAULT_CONFIG.workspacePrefix,
    syncIssueComments: typeof source.syncIssueComments === "boolean" ? source.syncIssueComments : DEFAULT_CONFIG.syncIssueComments,
    syncIssueDocuments: typeof source.syncIssueDocuments === "boolean" ? source.syncIssueDocuments : DEFAULT_CONFIG.syncIssueDocuments,
    enablePromptContext: typeof source.enablePromptContext === "boolean" ? source.enablePromptContext : DEFAULT_CONFIG.enablePromptContext,
    enablePeerChat: typeof source.enablePeerChat === "boolean" ? source.enablePeerChat : DEFAULT_CONFIG.enablePeerChat,
    observeMe: typeof source.observeMe === "boolean" ? source.observeMe : typeof source.observeAgentPeers === "boolean" ? source.observeAgentPeers : DEFAULT_CONFIG.observeMe,
    observeOthers: typeof source.observeOthers === "boolean" ? source.observeOthers : typeof source.observeAgentPeers === "boolean" ? source.observeAgentPeers : DEFAULT_CONFIG.observeOthers,
    noisePatterns: Array.isArray(source.noisePatterns) ? source.noisePatterns.filter((value) => typeof value === "string") : [...DEFAULT_CONFIG.noisePatterns],
    disableDefaultNoisePatterns: typeof source.disableDefaultNoisePatterns === "boolean" ? source.disableDefaultNoisePatterns : DEFAULT_CONFIG.disableDefaultNoisePatterns,
    stripPlatformMetadata: typeof source.stripPlatformMetadata === "boolean" ? source.stripPlatformMetadata : DEFAULT_CONFIG.stripPlatformMetadata,
    flushBeforeReset: typeof source.flushBeforeReset === "boolean" ? source.flushBeforeReset : DEFAULT_CONFIG.flushBeforeReset
  };
}
function getDeploymentMode(config) {
  return config.honchoApiBaseUrl === DEFAULT_CONFIG.honchoApiBaseUrl ? "cloud" : "self-hosted";
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
var mutedButtonStyle = {
  ...buttonStyle,
  background: "rgba(15, 23, 42, 0.04)"
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
        setError(nextError instanceof Error ? nextError.message : String(nextError));
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  async function save(nextConfig) {
    setSaving(true);
    try {
      await hostFetchJson(`/api/plugins/${PLUGIN_ID}/config`, {
        method: "POST",
        body: JSON.stringify({ configJson: nextConfig })
      });
      setConfigJson(nextConfig);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
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
      setError(nextError instanceof Error ? nextError.message : String(nextError));
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
      setError(nextError instanceof Error ? nextError.message : String(nextError));
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
        /* @__PURE__ */ jsx("span", { children: "Honcho API key secret" }),
        deploymentMode === "self-hosted" ? /* @__PURE__ */ jsx("span", { style: optionalTagStyle, children: "Optional" }) : null
      ] }),
      /* @__PURE__ */ jsxs(
        "select",
        {
          value: props.config.honchoApiKeySecretRef,
          onChange: (event) => props.onConfigChange({ honchoApiKeySecretRef: event.target.value }),
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
            props.onConfigChange({ honchoApiKeySecretRef: created.id });
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
      ["Observe me", props.config.observeMe, "observeMe"],
      ["Observe others", props.config.observeOthers, "observeOthers"]
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
  const repairMappings = usePluginAction(ACTION_KEYS.repairMappings);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [selectedActionKey, setSelectedActionKey] = useState(null);
  const status = memoryStatus.data;
  const companyStatus = status?.companyStatus;
  const canInitialize = Boolean(companyId && settings.configJson.honchoApiKeySecretRef);
  async function saveSettings() {
    setError(null);
    await settings.save(settings.configJson);
    memoryStatus.refresh();
    setNotice("Settings saved.");
  }
  async function runValidation() {
    setError(null);
    const result = await settings.test(settings.configJson);
    setNotice(result.valid ? result.message ?? "Configuration is valid." : result.message ?? "Configuration is invalid.");
  }
  async function triggerJob(jobKey) {
    setError(null);
    setNotice(null);
    try {
      await saveSettings();
      await jobs.triggerByKey(jobKey);
      memoryStatus.refresh();
      preview.refresh();
      jobStatus.refresh();
      setNotice(`Triggered ${jobKey}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  }
  async function runAction(action) {
    setSelectedActionKey(action.key);
    try {
      await action.run();
    } catch (nextError) {
      setNotice(null);
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  }
  const actions = [
    {
      key: "save-settings",
      label: "Save settings",
      group: "core",
      disabled: settings.loading || settings.saving,
      run: saveSettings
    },
    {
      key: "validate-config",
      label: "Validate config",
      group: "core",
      disabled: settings.loading,
      run: runValidation
    },
    {
      key: "test-connection",
      label: "Test connection",
      group: "core",
      disabled: !canInitialize,
      run: async () => {
        setError(null);
        setNotice(null);
        await testConnection({});
      }
    },
    {
      key: "initialize-memory",
      label: "Initialize memory for this company",
      group: "core",
      disabled: !canInitialize || jobs.loading,
      run: async () => {
        await triggerJob(JOB_KEYS.initializeMemory);
      }
    },
    {
      key: "migration-scan",
      label: "Rescan migration sources",
      group: "advanced",
      disabled: !companyId || jobs.loading,
      run: async () => {
        await triggerJob(JOB_KEYS.migrationScan);
      }
    },
    {
      key: "migration-import",
      label: "Import history",
      group: "advanced",
      disabled: !companyId || jobs.loading,
      run: async () => {
        await triggerJob(JOB_KEYS.migrationImport);
      }
    },
    {
      key: "repair-mappings",
      label: "Repair mappings",
      group: "advanced",
      disabled: !companyId,
      run: async () => {
        if (!companyId) return;
        try {
          setError(null);
          setNotice(null);
          await repairMappings({ companyId });
          setNotice("Mappings repaired.");
          memoryStatus.refresh();
        } catch (nextError) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      }
    }
  ];
  const groupedActions = [
    { key: "core", label: "Core actions", actions: actions.filter((action) => action.group === "core") },
    { key: "advanced", label: "Advanced actions", actions: actions.filter((action) => action.group === "advanced") }
  ];
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
      /* @__PURE__ */ jsx("div", { style: { fontSize: "1rem", fontWeight: 600 }, children: "Actions" }),
      /* @__PURE__ */ jsx("div", { style: { display: "grid", gap: "0.9rem" }, children: groupedActions.map((group) => /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "0.45rem" }, children: [
        /* @__PURE__ */ jsx("div", { style: { fontSize: "0.82rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#475569" }, children: group.label }),
        /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: "0.65rem", flexWrap: "wrap" }, children: group.actions.map((action) => {
          const style = selectedActionKey === action.key ? primaryButtonStyle : action.variant === "muted" ? mutedButtonStyle : buttonStyle;
          return /* @__PURE__ */ jsx(
            "button",
            {
              style,
              disabled: action.disabled,
              onClick: () => {
                void runAction(action);
              },
              children: action.label
            },
            action.key
          );
        }) })
      ] }, group.key)) }),
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
