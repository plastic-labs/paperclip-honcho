// @vitest-environment jsdom

import React from "react";
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
  migrationJobStatusResponses?: Array<Record<string, unknown> | null>;
  onJobTrigger?: (url: string) => void;
};

type PluginHookStubOptions = {
  testConnectionAction?: ReturnType<typeof vi.fn>;
  repairMappingsAction?: ReturnType<typeof vi.fn>;
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
    if (url.endsWith("/config")) {
      if ((init?.method ?? "GET") === "POST") {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
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
    if (key === ACTION_KEYS.repairMappings) return options.repairMappingsAction ?? vi.fn(async () => ({ ok: true }));
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

  it("runs activation steps in order and reports progress", async () => {
    const triggeredJobs: string[] = [];
    let resolveValidation: (() => void) | null = null;
    installFetchStub({
      configTestResponse: () => new Promise<Response>((resolve) => {
        resolveValidation = () => resolve(new Response(JSON.stringify({ valid: true, message: "Configuration is valid." }), { status: 200 }));
      }),
      onJobTrigger: (url) => {
        triggeredJobs.push(url);
      },
    });

    render(<HonchoSettingsPage context={testContext} />);

    await waitForActionButtonsReady();

    fireEvent.click(screen.getByRole("button", { name: "Initialize Honcho memory" }));

    await waitFor(() => {
      expect(screen.getByText("Step 1 of 3: Validating config")).toBeTruthy();
      expect((screen.getByRole("button", { name: "Save settings" }) as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole("button", { name: "Validating config..." }) as HTMLButtonElement).disabled).toBe(true);
    });

    resolveValidation?.();

    await waitFor(() => {
      expect(screen.getByText("Honcho activation completed.")).toBeTruthy();
    });

    const requestUrls = vi.mocked(fetch).mock.calls.map(([input]) => String(input));
    const configTestIndex = requestUrls.findIndex((url) => url.endsWith("/config/test"));
    const initializeIndex = requestUrls.findIndex((url) => url.includes("/jobs/job_init/trigger"));

    expect(configTestIndex).toBeGreaterThan(-1);
    expect(initializeIndex).toBeGreaterThan(configTestIndex);
    expect(triggeredJobs).toEqual([
      "/api/plugins/honcho-ai.paperclip-honcho/jobs/job_init/trigger",
    ]);
  });

  it("waits for each triggered job to complete before starting the next one", async () => {
    const triggeredJobs: string[] = [];
    installFetchStub({
      migrationJobStatusResponses: [
        { activeJobKey: "initialize-memory", status: "running", processed: 0, succeeded: 0, skipped: 0, failed: 0, currentSourceType: null, currentEntityId: null, lastError: null, updatedAt: "2026-04-09T21:39:00.000Z" },
        { activeJobKey: "initialize-memory", status: "complete", processed: 0, succeeded: 0, skipped: 0, failed: 0, currentSourceType: null, currentEntityId: null, lastError: null, updatedAt: "2026-04-09T21:39:01.000Z" },
      ],
      onJobTrigger: (url) => {
        triggeredJobs.push(url);
      },
    });

    render(<HonchoSettingsPage context={testContext} />);

    await waitForActionButtonsReady();

    fireEvent.click(screen.getByRole("button", { name: "Initialize Honcho memory" }));

    await waitFor(() => {
      expect(screen.getByText("Honcho activation completed.")).toBeTruthy();
    }, { timeout: 3_000 });

    const requestUrls = vi.mocked(fetch).mock.calls.map(([input]) => String(input));
    const initializeTriggerIndex = requestUrls.findIndex((url) => url.includes("/jobs/job_init/trigger"));
    const initializeStatusCompleteIndex = requestUrls.findIndex((url, index) => url.includes(`/data/${DATA_KEYS.migrationJobStatus}`) && index > initializeTriggerIndex);

    expect(initializeTriggerIndex).toBeGreaterThan(-1);
    expect(initializeStatusCompleteIndex).toBeGreaterThan(initializeTriggerIndex);
    expect(triggeredJobs).toEqual([
      "/api/plugins/honcho-ai.paperclip-honcho/jobs/job_init/trigger",
    ]);
  });

  it("keeps polling long-running initialization jobs without timing out after 15 seconds", async () => {
    installFetchStub({
      migrationJobStatusResponses: [
        ...Array.from({ length: 20 }, (_, index) => ({
          activeJobKey: "initialize-memory",
          status: "running",
          processed: index,
          succeeded: index,
          skipped: 0,
          failed: 0,
          currentSourceType: null,
          currentEntityId: null,
          lastError: null,
          updatedAt: `2026-04-09T21:39:${String(index).padStart(2, "0")}.000Z`,
        })),
        {
          activeJobKey: "initialize-memory",
          status: "complete",
          processed: 20,
          succeeded: 20,
          skipped: 0,
          failed: 0,
          currentSourceType: null,
          currentEntityId: null,
          lastError: null,
          updatedAt: "2026-04-09T21:42:20.000Z",
        },
      ],
    });

    render(<HonchoSettingsPage context={testContext} />);

    await waitForActionButtonsReady();

    vi.useFakeTimers();
    let nowMs = 0;
    vi.spyOn(Date, "now").mockImplementation(() => {
      const current = nowMs;
      nowMs += 1_000;
      return current;
    });

    fireEvent.click(screen.getByRole("button", { name: "Initialize Honcho memory" }));

    await vi.runAllTimersAsync();
    await Promise.resolve();
    await Promise.resolve();

    const requestUrls = vi.mocked(fetch).mock.calls.map(([input]) => String(input));
    const statusPolls = requestUrls.filter((url) => url.includes(`/data/${DATA_KEYS.migrationJobStatus}`));
    expect(statusPolls.length).toBeGreaterThanOrEqual(20);
    expect(screen.queryByText(/Activation failed during/)).toBeNull();
    expect(screen.queryByText(/Timed out waiting for initialize-memory to complete\./)).toBeNull();
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

    const body = JSON.parse(String(saveCall?.[1]?.body)) as { configJson: Record<string, unknown> };
    expect(body.configJson.honchoApiKey).toBe("secret_1");
    expect(body.configJson.observe_me).toBe(true);
    expect(body.configJson.observe_others).toBe(true);
    expect(body.configJson.honchoApiKeySecretRef).toBeUndefined();
    expect(body.configJson.observeMe).toBeUndefined();
    expect(body.configJson.observeOthers).toBeUndefined();
  });
});
