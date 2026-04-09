import {
  usePluginAction,
  usePluginData,
  type PluginDetailTabProps,
  type PluginSettingsPageProps,
} from "@paperclipai/plugin-sdk/ui";
import { useEffect, useMemo, useState } from "react";
import { ACTION_KEYS, DATA_KEYS, DEFAULT_CONFIG, JOB_KEYS, PLUGIN_ID } from "../constants.js";
import type {
  IssueMemoryStatusData,
  MemoryStatusData,
  MigrationJobStatusData,
  MigrationPreview,
} from "../types.js";
import { getDeploymentMode, normalizeSettingsConfig, type HonchoDeploymentMode, type SettingsConfig } from "./settings-config.js";

const sectionStyle: React.CSSProperties = {
  display: "grid",
  gap: "1rem",
  padding: "1rem",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.35)",
  borderRadius: "14px",
  padding: "1rem",
  display: "grid",
  gap: "0.75rem",
  background: "rgba(15, 23, 42, 0.03)",
};

const heroStyle: React.CSSProperties = {
  ...cardStyle,
  background: "linear-gradient(135deg, rgba(14, 116, 144, 0.09), rgba(15, 23, 42, 0.03))",
};

const buttonStyle: React.CSSProperties = {
  width: "fit-content",
  border: "1px solid rgba(15, 23, 42, 0.15)",
  borderRadius: "999px",
  padding: "0.55rem 0.9rem",
  background: "white",
  color: "#0f172a",
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#0f172a",
  color: "white",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid rgba(15, 23, 42, 0.12)",
  borderRadius: "10px",
  padding: "0.7rem 0.8rem",
  fontSize: "0.92rem",
  background: "white",
  color: "#0f172a",
  WebkitTextFillColor: "#0f172a",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: "0.4rem",
  fontSize: "0.9rem",
};

const labelHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  flexWrap: "wrap",
};

const optionalTagStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "999px",
  padding: "0.1rem 0.5rem",
  fontSize: "0.72rem",
  fontWeight: 600,
  letterSpacing: "0.01em",
  background: "rgba(15, 23, 42, 0.06)",
  color: "#475569",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gap: "0.9rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const statStyle: React.CSSProperties = {
  ...cardStyle,
  gap: "0.35rem",
  padding: "0.85rem",
};

type CompanySecretRecord = {
  id: string;
  name: string;
  description: string | null;
};

type PluginJobRecord = {
  id: string;
  jobKey: string;
  displayName: string;
  status: string;
};

type CompanyRecord = {
  id: string;
  name: string;
  issuePrefix?: string | null;
};

type ActivationStep = {
  errorLabel: string;
  label: string;
  run: () => Promise<void>;
};

function hostFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  return fetch(path, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  }).then(async (response) => {
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Request failed: ${response.status}`);
    }
    return await response.json() as T;
  });
}

function formatUnknownError(nextError: unknown): string {
  if (nextError instanceof Error) return nextError.message;
  if (nextError && typeof nextError === "object") {
    const message = "message" in nextError ? nextError.message : undefined;
    if (typeof message === "string" && message.length > 0) return message;
    const error = "error" in nextError ? nextError.error : undefined;
    if (typeof error === "string" && error.length > 0) return error;
    try {
      return JSON.stringify(nextError);
    } catch {
      return String(nextError);
    }
  }
  return String(nextError);
}

function validateSettingsBeforePersist(config: SettingsConfig) {
  if (getDeploymentMode(config) === "self-hosted" && !config.honchoApiBaseUrl.trim()) {
    throw new Error("Honcho API base URL is required for self-hosted or local deployments.");
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function useSettingsConfig() {
  const [configJson, setConfigJson] = useState<SettingsConfig>({ ...DEFAULT_CONFIG });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    hostFetchJson<{ configJson?: Record<string, unknown> | null } | null>(`/api/plugins/${PLUGIN_ID}/config`)
      .then((result) => {
        if (cancelled) return;
        setConfigJson(normalizeSettingsConfig(result?.configJson));
        setError(null);
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(formatUnknownError(nextError));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(nextConfig: SettingsConfig) {
    validateSettingsBeforePersist(nextConfig);
    setSaving(true);
    try {
      await hostFetchJson(`/api/plugins/${PLUGIN_ID}/config`, {
        method: "POST",
        body: JSON.stringify({ configJson: nextConfig }),
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

  async function test(nextConfig: SettingsConfig) {
    return await hostFetchJson<{ valid: boolean; message?: string }>(`/api/plugins/${PLUGIN_ID}/config/test`, {
      method: "POST",
      body: JSON.stringify({ configJson: nextConfig }),
    });
  }

  return {
    configJson,
    setConfigJson,
    loading,
    saving,
    error,
    save,
    test,
  };
}

function useCompanySecrets(companyId: string | null | undefined) {
  const [secrets, setSecrets] = useState<CompanySecretRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const result = await hostFetchJson<CompanySecretRecord[]>(`/api/companies/${companyId}/secrets`);
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

  async function createSecret(input: { name: string; value: string; description?: string | null }) {
    if (!companyId) throw new Error("companyId is required");
    setCreating(true);
    try {
      const created = await hostFetchJson<CompanySecretRecord>(`/api/companies/${companyId}/secrets`, {
        method: "POST",
        body: JSON.stringify(input),
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
  const [jobs, setJobs] = useState<PluginJobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const result = await hostFetchJson<PluginJobRecord[]>(`/api/plugins/${PLUGIN_ID}/jobs`);
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

  async function triggerByKey(jobKey: string) {
    const job = jobs.find((entry) => entry.jobKey === jobKey);
    if (!job) {
      await refresh();
    }
    const resolved = jobs.find((entry) => entry.jobKey === jobKey);
    if (!resolved) throw new Error(`Job not found: ${jobKey}`);
    await hostFetchJson(`/api/plugins/${PLUGIN_ID}/jobs/${resolved.id}/trigger`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    await refresh();
  }

  return { jobs, loading, error, refresh, triggerByKey };
}

function useCompanies() {
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);

  useEffect(() => {
    void hostFetchJson<CompanyRecord[]>("/api/companies")
      .then((result) => setCompanies(result))
      .catch(() => setCompanies([]));
  }, []);

  return companies;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "0.75rem", alignItems: "start" }}>
      <div style={{ fontSize: "0.85rem", color: "#475569" }}>{label}</div>
      <div style={{ fontSize: "0.92rem" }}>{value}</div>
    </div>
  );
}

function StatusPill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const palette = {
    neutral: { bg: "rgba(255,255,255,0.8)", fg: "#0f172a", border: "rgba(15,23,42,0.1)" },
    good: { bg: "rgba(16,185,129,0.12)", fg: "#047857", border: "rgba(16,185,129,0.25)" },
    warn: { bg: "rgba(245,158,11,0.12)", fg: "#b45309", border: "rgba(245,158,11,0.25)" },
    bad: { bg: "rgba(239,68,68,0.12)", fg: "#b91c1c", border: "rgba(239,68,68,0.25)" },
  }[tone];
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "0.4rem",
      borderRadius: "999px",
      padding: "0.25rem 0.65rem",
      fontSize: "0.82rem",
      border: `1px solid ${palette.border}`,
      background: palette.bg,
      color: palette.fg,
    }}>
      {label}
    </span>
  );
}

function countTone(value: string | null | undefined, good: string[] = ["complete", "connected", "active", "mapped", "created"]) {
  if (!value) return "neutral" as const;
  if (good.includes(value)) return "good" as const;
  if (value.includes("fail") || value === "degraded") return "bad" as const;
  if (value === "partial" || value === "preview_ready" || value === "running") return "warn" as const;
  return "neutral" as const;
}

function SecretSection(props: {
  companyId: string | null;
  config: SettingsConfig;
  onConfigChange(next: Partial<SettingsConfig>): void;
}) {
  const { secrets, refresh, createSecret, loading, creating, error } = useCompanySecrets(props.companyId);
  const deploymentMode = getDeploymentMode(props.config);
  const [draftOpen, setDraftOpen] = useState(false);
  const [customBaseUrlDraft, setCustomBaseUrlDraft] = useState(
    deploymentMode === "self-hosted" ? props.config.honchoApiBaseUrl : "",
  );
  const [draft, setDraft] = useState({
    name: "HONCHO_API_KEY",
    value: "",
    description: "Honcho API key for Paperclip memory activation",
  });

  useEffect(() => {
    if (deploymentMode === "self-hosted") {
      setCustomBaseUrlDraft(props.config.honchoApiBaseUrl);
    }
  }, [deploymentMode, props.config.honchoApiBaseUrl]);

  function updateDeploymentMode(nextMode: HonchoDeploymentMode) {
    if (nextMode === "cloud") {
      props.onConfigChange({ honchoApiBaseUrl: DEFAULT_CONFIG.honchoApiBaseUrl });
      return;
    }

    const nextBaseUrl = deploymentMode === "self-hosted" ? props.config.honchoApiBaseUrl : customBaseUrlDraft;
    props.onConfigChange({ honchoApiBaseUrl: nextBaseUrl });
  }

  return (
    <div style={cardStyle}>
      <div>
        <div style={{ fontSize: "1rem", fontWeight: 600 }}>Connect Honcho</div>
        <div style={{ color: "#475569", fontSize: "0.9rem" }}>
          Choose Honcho Cloud or a self-hosted/local deployment, then create or select a Paperclip secret that holds the Honcho API key.
        </div>
      </div>
      <label style={labelStyle}>
        <span style={labelHeaderStyle}>Deployment</span>
        <select
          value={deploymentMode}
          onChange={(event) => updateDeploymentMode(event.target.value as HonchoDeploymentMode)}
          style={selectStyle}
        >
          <option value="cloud">Honcho Cloud</option>
          <option value="self-hosted">Self-hosted / local</option>
        </select>
      </label>
      {deploymentMode === "cloud" ? (
        <div style={{ color: "#475569", fontSize: "0.9rem" }}>
          Using the default Honcho Cloud base URL: `{DEFAULT_CONFIG.honchoApiBaseUrl}`
        </div>
      ) : (
        <label style={labelStyle}>
          <span style={labelHeaderStyle}>Honcho API base URL</span>
          <input
            value={props.config.honchoApiBaseUrl}
            onChange={(event) => {
              const nextBaseUrl = event.target.value;
              setCustomBaseUrlDraft(nextBaseUrl);
              props.onConfigChange({ honchoApiBaseUrl: nextBaseUrl });
            }}
            style={inputStyle}
          />
          <span style={{ color: "#475569", fontSize: "0.82rem" }}>
            This URL must be reachable from the Paperclip host runtime. If Paperclip runs in Docker, `localhost` may not point at your machine.
          </span>
        </label>
      )}
      <label style={labelStyle}>
        <span style={labelHeaderStyle}>
          <span>Honcho API Key</span>
          {deploymentMode === "self-hosted" ? <span style={optionalTagStyle}>Optional</span> : null}
        </span>
        <select
          value={props.config.honchoApiKey}
          onChange={(event) => props.onConfigChange({ honchoApiKey: event.target.value })}
          style={selectStyle}
        >
          <option value="">Select a Paperclip secret…</option>
          {secrets.map((secret) => (
            <option key={secret.id} value={secret.id}>
              {secret.name}
            </option>
          ))}
        </select>
      </label>
      <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
        <button style={buttonStyle} onClick={() => void refresh()} disabled={loading}>
          Refresh secrets
        </button>
        <button style={buttonStyle} onClick={() => setDraftOpen((value) => !value)}>
          {draftOpen ? "Hide secret form" : "Create secret"}
        </button>
      </div>
      {draftOpen ? (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <label style={labelStyle}>
            <span>Secret name</span>
            <input
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            <span>Honcho API key value</span>
            <input
              type="password"
              value={draft.value}
              onChange={(event) => setDraft((current) => ({ ...current, value: event.target.value }))}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            <span>Description</span>
            <input
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              style={inputStyle}
            />
          </label>
          <button
            style={buttonStyle}
            disabled={!props.companyId || !draft.value.trim() || creating}
            onClick={async () => {
              const created = await createSecret(draft);
              props.onConfigChange({ honchoApiKey: created.id });
              setDraft((current) => ({ ...current, value: "" }));
              setDraftOpen(false);
            }}
          >
            Create and select secret
          </button>
        </div>
      ) : null}
      {error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}
    </div>
  );
}

function SyncProfileSection(props: {
  config: SettingsConfig;
  onConfigChange(next: Partial<SettingsConfig>): void;
}) {
  const recommended = useMemo<Partial<SettingsConfig>>(() => ({
    syncIssueComments: true,
    syncIssueDocuments: true,
    enablePeerChat: true,
  }), []);

  return (
    <div style={cardStyle}>
      <div>
        <div style={{ fontSize: "1rem", fontWeight: 600 }}>Recommended sync profile</div>
        <div style={{ color: "#475569", fontSize: "0.9rem" }}>
          The public-host-compatible package syncs issue comments and issue documents, then serves Honcho memory through tool-first workflows.
        </div>
      </div>
      <button style={buttonStyle} onClick={() => props.onConfigChange(recommended)}>
        Apply recommended profile
      </button>
      <div style={{ display: "grid", gap: "0.55rem" }}>
        {[
          ["Sync issue comments", props.config.syncIssueComments, "syncIssueComments"],
          ["Sync issue documents", props.config.syncIssueDocuments, "syncIssueDocuments"],
          ["Enable peer chat tool", props.config.enablePeerChat, "enablePeerChat"],
          ["observe_me", props.config.observe_me, "observe_me"],
          ["observe_others", props.config.observe_others, "observe_others"],
        ].map(([label, checked, key]) => (
          <label key={String(key)} style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
            <input
              type="checkbox"
              checked={Boolean(checked)}
              onChange={(event) => props.onConfigChange({ [String(key)]: event.target.checked } as Partial<SettingsConfig>)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <label style={labelStyle}>
        <span>Workspace prefix</span>
        <input
          value={props.config.workspacePrefix}
          onChange={(event) => props.onConfigChange({ workspacePrefix: event.target.value })}
          style={inputStyle}
        />
      </label>
    </div>
  );
}

function StatsGrid({ status }: { status: MemoryStatusData | null }) {
  if (!status) return null;
  const companyStatus = status.companyStatus;
  return (
    <div style={gridStyle}>
      <div style={statStyle}>
        <div style={{ fontSize: "0.82rem", color: "#475569" }}>Honcho connection</div>
        <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>{companyStatus?.connectionStatus ?? "unknown"}</div>
      </div>
      <div style={statStyle}>
        <div style={{ fontSize: "0.82rem", color: "#475569" }}>Mapped peers</div>
        <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>{status.counts.mappedPeers}</div>
      </div>
      <div style={statStyle}>
        <div style={{ fontSize: "0.82rem", color: "#475569" }}>Mapped sessions</div>
        <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>{status.counts.mappedSessions}</div>
      </div>
      <div style={statStyle}>
      <div style={{ fontSize: "0.82rem", color: "#475569" }}>Imported comments</div>
      <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>{status.counts.importedComments}</div>
      </div>
      <div style={statStyle}>
        <div style={{ fontSize: "0.82rem", color: "#475569" }}>Imported documents</div>
        <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>{status.counts.importedDocuments}</div>
      </div>
      <div style={statStyle}>
        <div style={{ fontSize: "0.82rem", color: "#475569" }}>Pending failures</div>
        <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>{companyStatus?.pendingFailureCount ?? 0}</div>
      </div>
    </div>
  );
}

export function HonchoSettingsPage({ context }: PluginSettingsPageProps) {
  const companies = useCompanies();
  const companyId = context.companyId ?? companies[0]?.id ?? null;
  const settings = useSettingsConfig();
  const jobs = usePluginJobs();
  const memoryStatus = usePluginData<MemoryStatusData>(DATA_KEYS.memoryStatus, companyId ? { companyId } : {});
  const preview = usePluginData<MigrationPreview | null>(DATA_KEYS.migrationPreview, companyId ? { companyId } : {});
  const jobStatus = usePluginData<MigrationJobStatusData>(DATA_KEYS.migrationJobStatus, companyId ? { companyId } : {});
  const testConnection = usePluginAction(ACTION_KEYS.testConnection);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [activationStepIndex, setActivationStepIndex] = useState<number | null>(null);
  const [activationStepLabel, setActivationStepLabel] = useState<string | null>(null);

  const status = memoryStatus.data;
  const companyStatus = status?.companyStatus;
  const deploymentMode = getDeploymentMode(settings.configJson);
  const canRunConnectionActions = deploymentMode === "cloud"
    ? Boolean(companyId && settings.configJson.honchoApiKey)
    : Boolean(companyId && settings.configJson.honchoApiBaseUrl.trim());
  const actionButtonsDisabled = settings.loading || settings.saving || jobs.loading || isActivating;

  function refreshActivationData() {
    memoryStatus.refresh();
    preview.refresh();
    jobStatus.refresh();
  }

  async function getCheckpointStatus() {
    if (!companyId) return null;
    const result = await hostFetchJson<{ data: MigrationJobStatusData }>(`/api/plugins/${PLUGIN_ID}/data/${DATA_KEYS.migrationJobStatus}`, {
      method: "POST",
      body: JSON.stringify({
        companyId,
        params: { companyId },
      }),
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

  async function triggerJob(jobKey: string) {
    await jobs.triggerByKey(jobKey);
    const timeoutAt = Date.now() + 15_000;
    while (Date.now() < timeoutAt) {
      const checkpoint = await getCheckpointStatus();
      if (checkpoint?.activeJobKey === jobKey && checkpoint.status === "failed") {
        throw new Error(checkpoint.lastError ?? `Job failed: ${jobKey}`);
      }
      if (checkpoint?.activeJobKey === jobKey && checkpoint.status === "complete") {
        refreshActivationData();
        return;
      }
      await sleep(100);
    }
    throw new Error(`Timed out waiting for ${jobKey} to complete.`);
  }

  async function runActivation() {
    const steps: ActivationStep[] = [
      {
        label: "Validating config",
        errorLabel: "validating config",
        run: async () => {
          await validateCurrentSettings();
          await settings.save(settings.configJson);
        },
      },
      {
        label: "Testing connection",
        errorLabel: "testing connection",
        run: async () => {
          await testConnection({});
        },
      },
      {
        label: "Initializing memory",
        errorLabel: "initializing memory",
        run: async () => {
          await triggerJob(JOB_KEYS.initializeMemory);
        },
      },
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

  return (
    <div style={sectionStyle}>
      <div style={heroStyle}>
        <div style={{ display: "grid", gap: "0.4rem" }}>
          <div style={{ fontSize: "1.35rem", fontWeight: 700 }}>Honcho Memory Activation</div>
          <div style={{ color: "#475569", maxWidth: "70ch" }}>
            Connect Honcho, initialize memory for this company, and import issue comments and issue documents without leaving Paperclip.
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <StatusPill label={`Connection: ${companyStatus?.connectionStatus ?? "unknown"}`} tone={countTone(companyStatus?.connectionStatus)} />
          <StatusPill label={`Initialization: ${companyStatus?.initializationStatus ?? "not_started"}`} tone={countTone(companyStatus?.initializationStatus)} />
          <StatusPill label={`Migration: ${companyStatus?.migrationStatus ?? "not_started"}`} tone={countTone(companyStatus?.migrationStatus)} />
        </div>
      </div>

      <SecretSection
        companyId={companyId}
        config={settings.configJson}
        onConfigChange={(next) => settings.setConfigJson((current) => ({ ...current, ...next }))}
      />

      <SyncProfileSection
        config={settings.configJson}
        onConfigChange={(next) => settings.setConfigJson((current) => ({ ...current, ...next }))}
      />

      <div style={cardStyle}>
        <div style={{ fontSize: "1rem", fontWeight: 600 }}>Company memory status</div>
        <StatsGrid status={status ?? null} />
        <Row label="Company" value={context.companyId ?? "No company selected"} />
        {!context.companyId && companies[0] ? (
          <Row label="Resolved company" value={`${companies[0].name} (${companies[0].issuePrefix ?? companies[0].id})`} />
        ) : null}
        <Row label="Last successful sync" value={companyStatus?.lastSuccessfulSyncAt ?? "Not synced yet"} />
        <Row label="Workspace status" value={companyStatus?.workspaceStatus ?? "unknown"} />
        <Row label="Peer status" value={companyStatus?.peerStatus ?? "not_started"} />
        <Row label="Checkpoint" value={jobStatus.data?.checkpoint?.status ?? "idle"} />
        <Row label="Current job" value={jobStatus.data?.checkpoint?.activeJobKey ?? "None"} />
        <Row label="Last initialization report" value={companyStatus?.lastInitializationReport ? "Available" : "None"} />
        <Row
          label="Compatibility mode"
          value="Tool-first memory is active. Run transcript import and legacy workspace file import require a newer Paperclip host."
        />
        {companyStatus?.lastError ? (
          <div style={{ color: "#b91c1c" }}>
            {companyStatus.lastError.message}
          </div>
        ) : null}
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: "1rem", fontWeight: 600 }}>Migration preview</div>
        <Row label="Source types" value={preview.data?.sourceTypes?.join(", ") ?? "Run a scan to generate preview"} />
        <Row label="Issue comments" value={preview.data?.totals.comments ?? 0} />
        <Row label="Issue documents" value={preview.data?.totals.documents ?? 0} />
        <Row label="Legacy files" value={(preview.data as Record<string, unknown> | null)?.totals && typeof (preview.data as Record<string, any>).totals.files === "number" ? (preview.data as Record<string, any>).totals.files : 0} />
        <Row label="Estimated messages" value={preview.data?.estimatedMessages ?? 0} />
        <Row label="Warnings" value={preview.data?.warnings?.join("; ") || "None"} />
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: "1rem", fontWeight: 600 }}>Activation</div>
        <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
          <button
            style={buttonStyle}
            disabled={actionButtonsDisabled}
            onClick={() => {
              void saveSettings().catch(() => undefined);
            }}
          >
            Save settings
          </button>
          <button
            style={isActivating ? primaryButtonStyle : buttonStyle}
            disabled={actionButtonsDisabled || !canRunConnectionActions}
            onClick={() => {
              void runActivation();
            }}
          >
            {isActivating ? `${activationStepLabel ?? "Initializing Honcho memory"}...` : "Initialize Honcho memory"}
          </button>
        </div>
        {isActivating && activationStepIndex !== null && activationStepLabel ? (
          <div style={{ color: "#475569" }}>{`Step ${activationStepIndex + 1} of 3: ${activationStepLabel}`}</div>
        ) : null}
        {notice ? <div style={{ color: "#0f766e" }}>{notice}</div> : null}
        {error || settings.error || jobs.error ? <div style={{ color: "#b91c1c" }}>{error ?? settings.error ?? jobs.error}</div> : null}
      </div>
    </div>
  );
}

export function HonchoIssueMemoryTab({ context }: PluginDetailTabProps) {
  const issueId = context.entityId;
  const companyId = context.companyId ?? "";
  const status = usePluginData<IssueMemoryStatusData>(DATA_KEYS.issueStatus, {
    issueId,
    companyId,
  });
  const resyncIssue = usePluginAction(ACTION_KEYS.resyncIssue);
  const issue = status.data;

  return (
    <div style={sectionStyle}>
      <div style={heroStyle}>
        <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>Issue memory proof</div>
        <div style={{ color: "#475569" }}>
          This tab stays intentionally small: sync markers, prompt-context previews, and a focused resync action for this issue.
        </div>
      </div>
      <div style={cardStyle}>
        <Row label="Issue" value={issue?.issueIdentifier ?? issueId} />
        <Row label="Last synced comment" value={issue?.lastSyncedCommentId ?? "Not synced"} />
        <Row label="Last synced document revision" value={issue?.lastSyncedDocumentRevisionId ?? "Not synced"} />
        <Row label="Latest append" value={issue?.latestAppendAt ?? "No append yet"} />
        <Row label="Latest prompt context build" value={issue?.latestPromptContextBuiltAt ?? "Not built"} />
        <Row label="Latest context fetch" value={issue?.contextFetchedAt ?? "Not fetched"} />
        {issue?.lastError ? (
          <div style={{ color: "#b91c1c" }}>{issue.lastError.message}</div>
        ) : null}
        <button
          style={buttonStyle}
          onClick={() => void resyncIssue({ issueId, companyId })}
          disabled={!companyId}
        >
          Resync this issue
        </button>
      </div>
      <div style={cardStyle}>
        <div style={{ fontWeight: 600 }}>Latest prompt context preview</div>
        <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
          {issue?.latestPromptContextPreview ?? "No prompt context preview available yet."}
        </pre>
      </div>
      <div style={cardStyle}>
        <div style={{ fontWeight: 600 }}>Latest session context preview</div>
        <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
          {issue?.contextPreview ?? "No session context preview available yet."}
        </pre>
      </div>
    </div>
  );
}

export function HonchoMemoryToolbarLauncher({ context }: { context: PluginSettingsPageProps["context"] }) {
  return <HonchoSettingsPage context={context} />;
}
