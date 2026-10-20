// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PluginSettingsPageProps } from "@paperclipai/plugin-sdk/ui";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACTION_KEYS, DATA_KEYS } from "../src/constants.js";

const mockUsePluginAction = vi.fn();
const mockUsePluginData = vi.fn();

vi.mock("@paperclipai/plugin-sdk/ui", async () => {
  const actual = await vi.importActual<typeof import("@paperclipai/plugin-sdk/ui")>("@paperclipai/plugin-sdk/ui");
  return {
    ...actual,
    usePluginAction: (...args: unknown[]) => mockUsePluginAction(...args),
    usePluginData: (...args: unknown[]) => mockUsePluginData(...args),
  };
});

import { HonchoSettingsPage } from "../src/ui/index.js";

type FetchStubOptions = {
  configTestResponse?: Response | (() => Response | Promise<Response>);
  configJsonOverrides?: Record<string, unknown>;
  failConfigLoadFor?: string;
  migrationJobStatusResponses?: Array<Record<string, unknown> | null>;
  onJobTrigger?: (url: string) => void;
};

type PluginHookStubOptions = {
  testConnectionAction?: ReturnType<typeof vi.fn>;
  initializeMemoryAction?: ReturnType<typeof vi.fn>;
  memoryStatusOverrides?: Record<string, unknown>;
};

function installFetchStub(options: FetchStubOptions = {}) {
  const migrationJobStatusResponses = [...(options.migrationJobStatusResponses ?? [])];
  let lastTriggeredJobKey: string | null = null;
  const fetchStub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url === "/api/companies") {
      return new Response(JSON.stringify([{ id: "co_1", name: "Paperclip", issuePrefix: "PAP" }]), { status: 200 });
    }
    if (url === "/api/companies/co_1/secrets") {
      if ((init?.method ?? "GET") === "POST") {
        return new Response(JSON.stringify({ id: "secret_1", name: "HONCHO_API_KEY", description: null }), { status: 200 });
      }
      return new Response(JSON.stringify([{ id: "secret_1", name: "HONCHO_API_KEY", description: null }]), { status: 200 });
    }
    if (url.split("?", 1)[0]!.endsWith("/config")) {
      if ((init?.method ?? "GET") === "POST") {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (options.failConfigLoadFor && url.endsWith(`?companyId=${options.failConfigLoadFor}`)) {
        return new Response("config unavailable", { status: 500 });
      }
      return new Response(JSON.stringify({
        configJson: {
          honchoApiKey: "secret_1",
          workspacePrefix: "paperclip",
          syncIssueComments: true,
          syncIssueDocuments: true,
          enablePromptContext: false,
          enablePeerChat: true,
          observe_me: true,
          observe_others: true,
          noisePatterns: [],
          disableDefaultNoisePatterns: false,
          stripPlatformMetadata: true,
          flushBeforeReset: false,
          ...options.configJsonOverrides,
        },
      }), { status: 200 });
    }
    if (url.endsWith("/config/test")) {
      if (options.configTestResponse) {
        return typeof options.configTestResponse === "function"
          ? await options.configTestResponse()
          : options.configTestResponse;
      }
      return new Response(JSON.stringify({ valid: true, message: "Configuration is valid." }), { status: 200 });
    }
    if (url.endsWith("/jobs")) {
      return new Response(JSON.stringify([
        { id: "job_init", jobKey: "initialize-memory", displayName: "Initialize", status: "idle" },
        { id: "job_scan", jobKey: "migration-scan", displayName: "Scan", status: "idle" },
        { id: "job_import", jobKey: "migration-import", displayName: "Import", status: "idle" },
      ]), { status: 200 });
    }
    if (url.includes(`/data/${DATA_KEYS.migrationJobStatus}`)) {
      const checkpoint = migrationJobStatusResponses.length > 0
        ? migrationJobStatusResponses.shift() ?? null
        : {
            activeJobKey: lastTriggeredJobKey,
            status: lastTriggeredJobKey ? "complete" : "idle",
            processed: 0,
            succeeded: 0,
            skipped: 0,
            failed: 0,
            currentSourceType: null,
            currentEntityId: null,
            lastError: null,
            updatedAt: null,
          };
      return new Response(JSON.stringify({ data: { checkpoint, companyId: "co_1" } }), { status: 200 });
    }
    if (url.includes("/jobs/") && url.endsWith("/trigger")) {
      if (url.includes("/jobs/job_init/trigger")) lastTriggeredJobKey = "initialize-memory";
      if (url.includes("/jobs/job_scan/trigger")) lastTriggeredJobKey = "migration-scan";
      if (url.includes("/jobs/job_import/trigger")) lastTriggeredJobKey = "migration-import";
      options.onJobTrigger?.(url);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });

  vi.stubGlobal("fetch", fetchStub);
}

function installPluginHookStubs(options: PluginHookStubOptions = {}) {
  mockUsePluginData.mockImplementation((key: string) => {
    if (key === DATA_KEYS.memoryStatus) {
      return {
        data: {
          companyStatus: {
            connectionStatus: "connected",
            initializationStatus: "complete",
            migrationStatus: "complete",
            promptContextStatus: "inactive",
            workspaceStatus: "mapped",
            peerStatus: "complete",
            lastSuccessfulSyncAt: null,
            pendingFailureCount: 0,
            lastInitializationReport: null,
            latestMigrationPreview: null,
            lastError: null,
            ...options.memoryStatusOverrides,
          },
          counts: {
            mappedPeers: 2,
            mappedSessions: 3,
            importedComments: 10,
            importedDocuments: 4,
            importedRuns: 0,
          },
        },
        refresh: vi.fn(),
      };
    }

    if (key === DATA_KEYS.migrationPreview) {
      return {
        data: {
          sourceTypes: ["issue_comments", "issue_documents"],
          totals: { comments: 10, documents: 4, files: 0 },
          estimatedMessages: 14,
          issues: [
            {
              issueId: "iss_1",
              issueIdentifier: "PAP-1",
              issueTitle: "Auth regression",
              commentCount: 8,
              documentCount: 4,
              estimatedMessages: 12,
            },
            {
              issueId: "iss_2",
              issueIdentifier: "PAP-2",
              issueTitle: "Billing follow-up",
              commentCount: 2,
              documentCount: 0,
              estimatedMessages: 2,
            },
          ],
          warnings: [],
        },
        refresh: vi.fn(),
      };
    }

    if (key === DATA_KEYS.migrationJobStatus) {
      return {
        data: {
          checkpoint: {
            status: "idle",
            activeJobKey: null,
          },
        },
        refresh: vi.fn(),
      };
    }

    return { data: null, refresh: vi.fn() };
  });

  mockUsePluginAction.mockImplementation((key: string) => {
    if (key === ACTION_KEYS.testConnection) return options.testConnectionAction ?? vi.fn(async () => ({ ok: true }));
    if (key === ACTION_KEYS.initializeMemoryForCompany) return options.initializeMemoryAction ?? vi.fn(async () => ({ ok: true }));
    if (key === ACTION_KEYS.probePromptContext) return vi.fn(async () => ({ status: "inactive", preview: null }));
    return vi.fn(async () => ({ ok: true }));
  });
}

async function waitForActionButtonsReady() {
  await waitFor(() => expect((screen.getByRole("button", { name: "Save settings" }) as HTMLButtonElement).disabled).toBe(false));
  await waitFor(() => expect(screen.getByRole("button", { name: "Initialize Honcho memory" })).toBeTruthy());
}

const testContext: PluginSettingsPageProps["context"] = {
  companyId: "co_1",
  companyPrefix: "PAP",
  projectId: null,
  entityId: null,
  entityType: null,
  userId: "user_1",
};

describe("HonchoSettingsPage", () => {
  beforeEach(() => {
    mockUsePluginAction.mockReset();
    mockUsePluginData.mockReset();
    installFetchStub();
    installPluginHookStubs();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("removes prompt-context UI from the settings page", async () => {
    installFetchStub({
      configJsonOverrides: {
        enablePromptContext: true,
      },
    });
    installPluginHookStubs({
      memoryStatusOverrides: {
        promptContextStatus: "active",
      },
    });

    render(<HonchoSettingsPage context={testContext} />);

    await waitForActionButtonsReady();

    expect(screen.queryByText(/Prompt context:/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Preview prompt context" })).toBeNull();
    expect(screen.queryByLabelText("Inject Honcho prompt context")).toBeNull();
    expect(screen.queryByText(/manual prompt previews/i)).toBeNull();
  });

  it("shows only save settings and initialize honcho memory in the action section", async () => {
    render(<HonchoSettingsPage context={testContext} />);

    await waitForActionButtonsReady();

    expect(screen.getByRole("button", { name: "Save settings" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Initialize Honcho memory" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Validate config" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Test connection" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Initialize memory for this company" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rescan migration sources" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Import history" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Repair mappings" })).toBeNull();
  });

  it("renders per-issue migration counts in the preview", async () => {
    render(<HonchoSettingsPage context={testContext} />);

    await waitForActionButtonsReady();

    expect(screen.getByText("Migration mapping")).toBeTruthy();
    expect(screen.getByText("PAP-1")).toBeTruthy();
    expect(screen.getByText("Auth regression")).toBeTruthy();
    expect(screen.getByText("8 comments • 4 documents")).toBeTruthy();
    expect(screen.getByText("12 messages")).toBeTruthy();
    expect(screen.getByText("PAP-2")).toBeTruthy();
    expect(screen.getByText("2 comments • 0 documents")).toBeTruthy();
  });

  it("autosaves settings changes after a debounce", async () => {
    render(<HonchoSettingsPage context={testContext} />);

    await waitForActionButtonsReady();

    vi.useFakeTimers();

    fireEvent.click(screen.getByLabelText("Enable peer chat tool"));

    const configPostsBeforeDebounce = vi.mocked(fetch).mock.calls.filter(([input, init]) => {
      return String(input).endsWith("/config") && (init?.method ?? "GET") === "POST";
    });
    expect(configPostsBeforeDebounce).toHaveLength(0);

    await vi.runAllTimersAsync();
    await Promise.resolve();

    const configPosts = vi.mocked(fetch).mock.calls.filter(([input, init]) => {
      return String(input).endsWith("/config") && (init?.method ?? "GET") === "POST";
    });
    expect(configPosts).toHaveLength(1);
  });

  it("runs activation steps in order and reports progress", async () => {
    const triggeredJobs: string[] = [];
    // The first call runs out of time; the page calls again until done.
    const initializeAction = vi.fn()
      .mockResolvedValueOnce({ ok: true, done: false })
      .mockResolvedValueOnce({ ok: true, done: true });
    let resolveValidation: () => void = () => {
      throw new Error("Validation resolver was not initialized");
    };
    installFetchStub({
      configTestResponse: () => new Promise<Response>((resolve) => {
        resolveValidation = () => resolve(new Response(JSON.stringify({ valid: true, message: "Configuration is valid." }), { status: 200 }));
      }),
      onJobTrigger: (url) => {
        triggeredJobs.push(url);
      },
    });
    installPluginHookStubs({
      testConnectionAction: vi.fn(async () => ({ ok: true })),
      initializeMemoryAction: initializeAction,
    });

    render(<HonchoSettingsPage context={testContext} />);

    await waitForActionButtonsReady();

    fireEvent.click(screen.getByRole("button", { name: "Initialize Honcho memory" }));

    await waitFor(() => {
      expect(screen.getByText("Step 1 of 3: Validating config")).toBeTruthy();
      expect((screen.getByRole("button", { name: "Save settings" }) as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole("button", { name: "Validating config..." }) as HTMLButtonElement).disabled).toBe(true);
    });

    resolveValidation();

    await waitFor(() => {
      expect(screen.getByText("Honcho activation completed.")).toBeTruthy();
    });

    const requestUrls = vi.mocked(fetch).mock.calls.map(([input]) => String(input));
    const configTestIndex = requestUrls.findIndex((url) => url.endsWith("/config/test"));
    const initializeIndex = initializeAction.mock.invocationCallOrder[0] ?? -1;

    expect(configTestIndex).toBeGreaterThan(-1);
    expect(initializeIndex).toBeGreaterThan(0);
    // The action does the work. The job trigger route is instance-admin only.
    expect(triggeredJobs).toEqual([]);
    expect(initializeAction.mock.calls).toEqual([[{ companyId: "co_1" }], [{ companyId: "co_1" }]]);
  });

  it("stops activation on the first failure and shows the step-specific error", async () => {
    installFetchStub({
      configTestResponse: new Response("validation failed", { status: 500 }),
    });

    render(<HonchoSettingsPage context={testContext} />);

    await waitForActionButtonsReady();

    fireEvent.click(screen.getByRole("button", { name: "Initialize Honcho memory" }));

    await waitFor(() => {
      expect(screen.getByText("Activation failed during validating config: validation failed")).toBeTruthy();
    });

    const fetchCalls = vi.mocked(fetch).mock.calls;
    const triggerCalls = fetchCalls.filter(([input]) => String(input).includes("/jobs/") && String(input).endsWith("/trigger"));
    expect(triggerCalls).toHaveLength(0);
  });

  it("renders structured thrown errors without falling back to object stringification", async () => {
    installFetchStub({
      configTestResponse: async () => {
        throw { error: "validation failed" };
      },
    });

    render(<HonchoSettingsPage context={testContext} />);

    await waitForActionButtonsReady();

    fireEvent.click(screen.getByRole("button", { name: "Initialize Honcho memory" }));

    await waitFor(() => {
      expect(screen.getByText("Activation failed during validating config: validation failed")).toBeTruthy();
    });
    expect(screen.queryByText("[object Object]")).toBeNull();
  });

  it("never saves one company's settings into another after a company switch", async () => {
    installFetchStub({ failConfigLoadFor: "co_2" });
    const { rerender } = render(<HonchoSettingsPage context={testContext} />);
    await waitForActionButtonsReady();

    // The host keeps the page mounted and only changes the selected company.
    rerender(<HonchoSettingsPage context={{ ...testContext, companyId: "co_2" }} />);
    await waitFor(() => expect(screen.getByText("config unavailable")).toBeTruthy());
    await waitForActionButtonsReady();
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() => expect(screen.getByText(/did not load/)).toBeTruthy());

    const configPosts = vi.mocked(fetch).mock.calls.filter(([input, init]) => {
      return String(input).endsWith("/config") && (init?.method ?? "GET") === "POST";
    });
    expect(configPosts).toHaveLength(0);
  });

  it("hides the base URL placeholder and marks the API key as optional for self-hosted deployments", async () => {
    render(<HonchoSettingsPage context={testContext} />);

    await waitForActionButtonsReady();

    expect(screen.getByText("Honcho API Key")).toBeTruthy();
    expect(screen.queryByText("Optional")).toBeNull();

    fireEvent.change(screen.getByLabelText("Deployment"), {
      target: { value: "self-hosted" },
    });

    const baseUrlLabel = screen.getByText("Honcho API base URL").closest("label");
    const baseUrlInput = baseUrlLabel?.querySelector("input") as HTMLInputElement | null;

    if (!baseUrlInput) {
      throw new Error("expected Honcho API base URL input to be rendered");
    }
    expect(baseUrlInput.getAttribute("placeholder")).toBeNull();
    expect(screen.getByText("Optional")).toBeTruthy();
  });

  it("blocks saving and initialization when self-hosted Honcho has no base URL", async () => {
    render(<HonchoSettingsPage context={testContext} />);

    await waitForActionButtonsReady();

    fireEvent.change(screen.getByLabelText("Deployment"), {
      target: { value: "self-hosted" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => {
      expect(screen.getByText("Honcho API base URL is required for self-hosted or local deployments.")).toBeTruthy();
    });

    let fetchCalls = vi.mocked(fetch).mock.calls;
    let saveCalls = fetchCalls.filter(([input, init]) => String(input).endsWith("/config") && (init?.method ?? "GET") === "POST");
    expect(saveCalls).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Initialize Honcho memory" }));

    await waitFor(() => {
      expect(screen.getByText("Honcho API base URL is required for self-hosted or local deployments.")).toBeTruthy();
    });

    fetchCalls = vi.mocked(fetch).mock.calls;
    saveCalls = fetchCalls.filter(([input, init]) => String(input).endsWith("/config") && (init?.method ?? "GET") === "POST");
    const triggerCalls = fetchCalls.filter(([input]) => String(input).includes("/jobs/") && String(input).endsWith("/trigger"));
    expect(saveCalls).toHaveLength(0);
    expect(triggerCalls).toHaveLength(0);
  });

  it("keeps activation enabled for self-hosted Honcho without an API key secret", async () => {
    installFetchStub({
      configJsonOverrides: {
        honchoApiKey: "",
      },
    });

    render(<HonchoSettingsPage context={testContext} />);

    await waitForActionButtonsReady();

    fireEvent.change(screen.getByLabelText("Deployment"), {
      target: { value: "self-hosted" },
    });

    const baseUrlLabel = screen.getByText("Honcho API base URL").closest("label");
    const baseUrlInput = baseUrlLabel?.querySelector("input") as HTMLInputElement | null;
    if (!baseUrlInput) {
      throw new Error("expected Honcho API base URL input to be rendered");
    }
    fireEvent.change(baseUrlInput, {
      target: { value: "http://127.0.0.1:8000" },
    });

    await waitFor(() => {
      expect((screen.getByRole("button", { name: "Initialize Honcho memory" }) as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it("preserves hidden prompt-context config when applying the recommended profile", async () => {
    installFetchStub({
      configJsonOverrides: {
        enablePromptContext: true,
        syncIssueComments: false,
        syncIssueDocuments: false,
        enablePeerChat: false,
      },
    });

    render(<HonchoSettingsPage context={testContext} />);

    await waitForActionButtonsReady();

    fireEvent.click(screen.getByRole("button", { name: "Apply recommended profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => expect(screen.getByText("Settings saved.")).toBeTruthy());

    const fetchCalls = vi.mocked(fetch).mock.calls;
    const saveCall = fetchCalls.find(([input, init]) => String(input).endsWith("/config") && (init?.method ?? "GET") === "POST");
    expect(saveCall).toBeTruthy();

    const body = JSON.parse(String(saveCall?.[1]?.body)) as { configJson: { enablePromptContext: boolean; syncIssueComments: boolean; syncIssueDocuments: boolean; enablePeerChat: boolean } };
    expect(body.configJson.enablePromptContext).toBe(true);
    expect(body.configJson.syncIssueComments).toBe(true);
    expect(body.configJson.syncIssueDocuments).toBe(true);
    expect(body.configJson.enablePeerChat).toBe(true);
  });

  it("saves the renamed public config keys", async () => {
    render(<HonchoSettingsPage context={testContext} />);

    await waitForActionButtonsReady();

    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => expect(screen.getByText("Settings saved.")).toBeTruthy());

    const fetchCalls = vi.mocked(fetch).mock.calls;
    const saveCall = fetchCalls.find(([input, init]) => String(input).endsWith("/config") && (init?.method ?? "GET") === "POST");
    expect(saveCall).toBeTruthy();

    const body = JSON.parse(String(saveCall?.[1]?.body)) as { companyId?: string; configJson: Record<string, unknown> };
    expect(body.companyId).toBe("co_1");
    expect(fetchCalls.map(([input]) => String(input))).toContain("/api/plugins/honcho-ai.paperclip-honcho/config?companyId=co_1");
    expect(body.configJson.honchoApiKey).toBe("secret_1");
    expect(body.configJson.observe_me).toBe(true);
    expect(body.configJson.observe_others).toBe(true);
    expect(body.configJson.honchoApiKeySecretRef).toBeUndefined();
    expect(body.configJson.observeMe).toBeUndefined();
    expect(body.configJson.observeOthers).toBeUndefined();
  });
});
