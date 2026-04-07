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
};

type PluginHookStubOptions = {
  testConnectionAction?: ReturnType<typeof vi.fn>;
  repairMappingsAction?: ReturnType<typeof vi.fn>;
};

function installFetchStub(options: FetchStubOptions = {}) {
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
          honchoApiKeySecretRef: "secret_1",
          workspacePrefix: "paperclip",
          syncIssueComments: true,
          syncIssueDocuments: true,
          enablePromptContext: false,
          enablePeerChat: true,
          observeMe: true,
          observeOthers: true,
          noisePatterns: [],
          disableDefaultNoisePatterns: false,
          stripPlatformMetadata: true,
          flushBeforeReset: false,
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
    if (url.includes("/jobs/") && url.endsWith("/trigger")) {
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
  await waitFor(() => expect((screen.getByRole("button", { name: "Validate config" }) as HTMLButtonElement).disabled).toBe(false));
  await waitFor(() => expect((screen.getByRole("button", { name: "Repair mappings" }) as HTMLButtonElement).disabled).toBe(false));
}

function isSelected(button: HTMLButtonElement) {
  return button.style.background === "rgb(15, 23, 42)" && button.style.color === "white";
}

function hasDefaultButtonStyle(button: HTMLButtonElement) {
  return button.style.background === "white" && button.style.color === "rgb(15, 23, 42)";
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
  });

  it("removes prompt-context UI from the settings page", async () => {
    render(<HonchoSettingsPage context={testContext} />);

    await waitForActionButtonsReady();

    expect(screen.queryByText(/Prompt context:/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Preview prompt context" })).toBeNull();
    expect(screen.queryByLabelText("Inject Honcho prompt context")).toBeNull();
    expect(screen.queryByText(/manual prompt previews/i)).toBeNull();
  });

  it("groups actions and tracks the last clicked action as selected", async () => {
    render(<HonchoSettingsPage context={testContext} />);

    await waitForActionButtonsReady();

    expect(screen.getByText("Core actions")).toBeTruthy();
    expect(screen.getByText("Advanced actions")).toBeTruthy();

    const initializeButton = screen.getByRole("button", { name: "Initialize memory for this company" }) as HTMLButtonElement;
    const repairButton = screen.getByRole("button", { name: "Repair mappings" }) as HTMLButtonElement;
    const validateButton = screen.getByRole("button", { name: "Validate config" }) as HTMLButtonElement;
    const refreshSecretsButton = screen.getByRole("button", { name: "Refresh secrets" }) as HTMLButtonElement;

    expect(isSelected(initializeButton)).toBe(false);
    expect(isSelected(repairButton)).toBe(false);
    expect(isSelected(validateButton)).toBe(false);
    expect(hasDefaultButtonStyle(repairButton)).toBe(true);
    expect(hasDefaultButtonStyle(refreshSecretsButton)).toBe(true);

    fireEvent.click(repairButton);
    await waitFor(() => expect(isSelected(repairButton)).toBe(true));
    expect(isSelected(validateButton)).toBe(false);

    fireEvent.click(validateButton);
    await waitFor(() => expect(isSelected(validateButton)).toBe(true));
    expect(isSelected(repairButton)).toBe(false);
  });

  it("shows action failures in the shared error banner", async () => {
    installFetchStub({
      configTestResponse: new Response("validation failed", { status: 500 }),
    });

    render(<HonchoSettingsPage context={testContext} />);

    await waitForActionButtonsReady();

    fireEvent.click(screen.getByRole("button", { name: "Validate config" }));

    await waitFor(() => expect(screen.getByText("validation failed")).toBeTruthy());
  });
});
