import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import { PLUGIN_VERSION } from "../src/constants.js";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { getResolvedConfig } from "../src/config.js";
import { workspaceIdForCompany } from "../src/ids.js";
import { BASE_CONFIG, createHonchoHarness, installFetchMock, requestsMatching } from "./helpers.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const companyWorkspaceId = workspaceIdForCompany("co_1", "paperclip", "Paperclip");

describe("honcho config", () => {
  it("uses the shared plugin version constant in the manifest", () => {
    expect(manifest.version).toBe(PLUGIN_VERSION);
  });

  it("declares the settings page and issue memory tab using the current plugin framework slots", () => {
    expect(manifest.capabilities).toEqual(expect.arrayContaining([
      "instance.settings.register",
      "jobs.schedule",
      "ui.detailTab.register",
      "ui.action.register",
      "agent.tools.register",
    ]));
    expect(manifest.capabilities).not.toEqual(expect.arrayContaining([
      "agent.promptContext.provide",
      "runs.read",
      "project.workspaces.files.read",
    ]));
    expect(manifest.jobs).toEqual(expect.arrayContaining([
      expect.objectContaining({ jobKey: "initialize-memory" }),
      expect.objectContaining({ jobKey: "migration-scan" }),
      expect.objectContaining({ jobKey: "migration-import" }),
    ]));
    expect(manifest.ui?.slots).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "settingsPage", displayName: "Honcho Settings" }),
      expect.objectContaining({ type: "detailTab", displayName: "Memory" }),
    ]));
    expect(manifest.ui?.launchers).toEqual(expect.arrayContaining([
      expect.objectContaining({ placementZone: "globalToolbarButton", displayName: "Honcho Memory" }),
    ]));
    expect(manifest.instanceConfigSchema?.properties).toMatchObject({
      observe_me: expect.objectContaining({ title: "Observe Current Agent" }),
      observe_others: expect.objectContaining({ title: "Observe Other Participants" }),
    });
  });

  it("normalizes config values and applies defaults", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        honchoApiBaseUrl: " https://api.honcho.dev/ ",
        honchoApiKey: " HONCHO_API_KEY ",
        workspacePrefix: "   ",
        syncIssueComments: "unexpected",
        syncIssueDocuments: true,
        enablePromptContext: "yep",
        enablePeerChat: "nope",
        observe_me: "nope",
        observe_others: "nope",
        observeAgentPeers: "nope",
        noisePatterns: ["test"],
        disableDefaultNoisePatterns: "nope",
        stripPlatformMetadata: "nope",
        flushBeforeReset: "nope",
      },
    });

    const resolved = await getResolvedConfig(harness.ctx);

    expect(resolved.honchoApiBaseUrl).toBe("https://api.honcho.dev/");
    expect(resolved.honchoApiKey).toBe("HONCHO_API_KEY");
    expect(resolved.workspacePrefix).toBe(BASE_CONFIG.workspacePrefix);
    expect(resolved.syncIssueComments).toBe(true);
    expect(resolved.syncIssueDocuments).toBe(true);
    expect(resolved.enablePromptContext).toBe(false);
    expect(resolved.enablePeerChat).toBe(true);
    expect(resolved.observe_me).toBe(true);
    expect(resolved.observe_others).toBe(true);
    expect(resolved.noisePatterns).toEqual(["test"]);
    expect(resolved.disableDefaultNoisePatterns).toBe(false);
    expect(resolved.stripPlatformMetadata).toBe(true);
    expect(resolved.flushBeforeReset).toBe(false);
  });

  it("implements the current SDK config validation hook", async () => {
    const result = await plugin.definition.onValidateConfig?.({
      honchoApiBaseUrl: "ftp://api.honcho.dev",
      honchoApiKey: "",
      workspacePrefix: "paperclip",
    });

    expect(result?.ok).toBe(false);
    expect(result?.errors).toEqual([
      "Honcho base URL must use http or https",
    ]);
  });

  it("allows self-hosted config validation without an API key secret", async () => {
    const result = await plugin.definition.onValidateConfig?.({
      ...BASE_CONFIG,
      honchoApiBaseUrl: "http://127.0.0.1:8000",
      honchoApiKey: "",
    });

    expect(result?.ok).toBe(true);
    expect(result?.errors).toBeUndefined();
  });

  it("treats an explicitly empty base URL as invalid instead of falling back to Honcho Cloud", async () => {
    const result = await plugin.definition.onValidateConfig?.({
      ...BASE_CONFIG,
      honchoApiBaseUrl: "",
      honchoApiKey: "",
    });

    expect(result?.ok).toBe(false);
    expect(result?.errors).toEqual([
      "Honcho base URL is required",
    ]);
  });

  it("warns when all syncing is disabled without rejecting the config", async () => {
    const result = await plugin.definition.onValidateConfig?.({
      ...BASE_CONFIG,
      syncIssueComments: false,
      syncIssueDocuments: false,
    });

    expect(result?.ok).toBe(true);
    expect(result?.warnings?.[0]).toContain("disabled");
  });

  it("fails test-connection before any outbound request when config is invalid", async () => {
    const { fetchMock } = installFetchMock();
    const harness = createHonchoHarness({
      config: {
        honchoApiKey: "",
      },
    });

    await plugin.definition.setup(harness.ctx);

    await expect(harness.performAction("test-connection")).rejects.toThrow("Honcho API key is required");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows test-connection for self-hosted Honcho without an API key secret", async () => {
    const { requests } = installFetchMock();
    const harness = createHonchoHarness({
      config: {
        honchoApiBaseUrl: "http://127.0.0.1:8000",
        honchoApiKey: "",
      },
    });

    await plugin.definition.setup(harness.ctx);

    const result = await harness.performAction("test-connection");
    expect(result).toMatchObject({
      ok: true,
      workspaceId: companyWorkspaceId,
    });

    const workspaceRequest = requestsMatching(requests, "/v3/workspaces")[0];
    expect(workspaceRequest?.headers.authorization).toBeUndefined();
  });

  it("forwards a configured API key to self-hosted Honcho connections", async () => {
    const { requests } = installFetchMock();
    const harness = createHonchoHarness({
      config: {
        honchoApiBaseUrl: "http://127.0.0.1:8000",
        honchoApiKey: "HONCHO_API_KEY",
      },
    });

    await plugin.definition.setup(harness.ctx);

    const result = await harness.performAction("test-connection");
    expect(result).toMatchObject({
      ok: true,
      workspaceId: companyWorkspaceId,
    });

    const workspaceRequest = requestsMatching(requests, "/v3/workspaces")[0];
    expect(workspaceRequest?.headers.authorization).toBe("Bearer resolved:HONCHO_API_KEY");
  });

  it("accepts legacy config aliases while resolving to the renamed public keys", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        honchoApiKeySecretRef: " LEGACY_KEY ",
        observeMe: false,
        observeOthers: true,
      },
    });

    const resolved = await getResolvedConfig(harness.ctx);

    expect(resolved.honchoApiKey).toBe("LEGACY_KEY");
    expect(resolved.observe_me).toBe(false);
    expect(resolved.observe_others).toBe(true);
  });
});
