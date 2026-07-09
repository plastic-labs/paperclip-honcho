import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import plugin from "../src/worker.js";
import { createHonchoHarness, installFetchMock, requestsMatching } from "./helpers.js";

// Hermetic home directory so the test never touches the developer's real
// ~/.honcho/config.json. node:os.homedir() is redirected to this temp dir.
let fakeHome: string;

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, homedir: () => fakeHome };
});

function writeLocalHonchoConfig(contents: Record<string, unknown>): void {
  mkdirSync(join(fakeHome, ".honcho"), { recursive: true });
  writeFileSync(join(fakeHome, ".honcho", "config.json"), JSON.stringify(contents));
}

describe("local Honcho config fallback (Hermes/Claude-Code shared config)", () => {
  beforeEach(() => {
    fakeHome = mkdtempSync(join(tmpdir(), "honcho-home-"));
    delete process.env.HERMES_HOME;
  });

  afterEach(() => {
    rmSync(fakeHome, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("reuses the local Honcho API key when opted in and no secret is configured", async () => {
    writeLocalHonchoConfig({ apiKey: "local-key-123", baseUrl: "http://api.honcho.dev" });
    const { requests } = installFetchMock();
    const harness = createHonchoHarness({
      config: {
        honchoApiBaseUrl: "http://127.0.0.1:8000",
        honchoApiKey: "",
        useLocalHonchoConfig: true,
      },
    });

    await plugin.definition.setup(harness.ctx);
    await harness.performAction("test-connection");

    const workspaceRequest = requestsMatching(requests, "/v3/workspaces")[0];
    expect(workspaceRequest?.headers.authorization).toBe("Bearer local-key-123");
  });

  it("does NOT read the local config when the toggle is off (keyless stays keyless)", async () => {
    writeLocalHonchoConfig({ apiKey: "should-not-be-used" });
    const { requests } = installFetchMock();
    const harness = createHonchoHarness({
      config: {
        honchoApiBaseUrl: "http://127.0.0.1:8000",
        honchoApiKey: "",
        useLocalHonchoConfig: false,
      },
    });

    await plugin.definition.setup(harness.ctx);
    await harness.performAction("test-connection");

    const workspaceRequest = requestsMatching(requests, "/v3/workspaces")[0];
    expect(workspaceRequest?.headers.authorization).toBeUndefined();
  });

  it("adopts the local base URL alongside its key when Paperclip is left at the cloud default", async () => {
    writeLocalHonchoConfig({ apiKey: "local-key-123", baseUrl: "http://127.0.0.1:9999" });
    const { requests } = installFetchMock();
    const harness = createHonchoHarness({
      config: {
        honchoApiBaseUrl: "https://api.honcho.dev",
        honchoApiKey: "",
        useLocalHonchoConfig: true,
      },
    });

    await plugin.definition.setup(harness.ctx);
    await harness.performAction("test-connection");

    const workspaceRequest = requestsMatching(requests, "/v3/workspaces")[0];
    expect(workspaceRequest?.url.startsWith("http://127.0.0.1:9999/")).toBe(true);
    expect(workspaceRequest?.headers.authorization).toBe("Bearer local-key-123");
  });

  it("keeps an explicitly-configured Paperclip base URL over the local config's", async () => {
    writeLocalHonchoConfig({ apiKey: "local-key-123", baseUrl: "http://127.0.0.1:9999" });
    const { requests } = installFetchMock();
    const harness = createHonchoHarness({
      config: {
        honchoApiBaseUrl: "http://10.0.0.5:8000",
        honchoApiKey: "",
        useLocalHonchoConfig: true,
      },
    });

    await plugin.definition.setup(harness.ctx);
    await harness.performAction("test-connection");

    const workspaceRequest = requestsMatching(requests, "/v3/workspaces")[0];
    expect(workspaceRequest?.url.startsWith("http://10.0.0.5:8000/")).toBe(true);
    expect(workspaceRequest?.headers.authorization).toBe("Bearer local-key-123");
  });

  it("prefers a literal configured key over the local config", async () => {
    writeLocalHonchoConfig({ apiKey: "local-key-should-lose" });
    const { requests } = installFetchMock();
    const harness = createHonchoHarness({
      config: {
        honchoApiBaseUrl: "http://127.0.0.1:8000",
        honchoApiKey: "configured-key-should-win",
        useLocalHonchoConfig: true,
      },
    });

    await plugin.definition.setup(harness.ctx);
    await harness.performAction("test-connection");

    const workspaceRequest = requestsMatching(requests, "/v3/workspaces")[0];
    expect(workspaceRequest?.headers.authorization).toBe("Bearer configured-key-should-win");
  });

  it("falls back to HONCHO_API_KEY before the local config", async () => {
    writeLocalHonchoConfig({ apiKey: "local-key-should-lose" });
    process.env.HONCHO_API_KEY = "env-key-should-win";
    try {
      const { requests } = installFetchMock();
      const harness = createHonchoHarness({
        config: {
          honchoApiBaseUrl: "http://127.0.0.1:8000",
          honchoApiKey: "",
          useLocalHonchoConfig: true,
        },
      });

      await plugin.definition.setup(harness.ctx);
      await harness.performAction("test-connection");

      const workspaceRequest = requestsMatching(requests, "/v3/workspaces")[0];
      expect(workspaceRequest?.headers.authorization).toBe("Bearer env-key-should-win");
    } finally {
      delete process.env.HONCHO_API_KEY;
    }
  });

  it("pairs HONCHO_API_BASE_URL with the env key when Paperclip is left at the cloud default", async () => {
    process.env.HONCHO_API_KEY = "env-key";
    process.env.HONCHO_API_BASE_URL = "http://127.0.0.1:9999";
    try {
      const { requests } = installFetchMock();
      const harness = createHonchoHarness({
        config: {
          honchoApiBaseUrl: "https://api.honcho.dev",
          honchoApiKey: "",
          useLocalHonchoConfig: true,
        },
      });

      await plugin.definition.setup(harness.ctx);
      await harness.performAction("test-connection");

      const workspaceRequest = requestsMatching(requests, "/v3/workspaces")[0];
      expect(workspaceRequest?.url.startsWith("http://127.0.0.1:9999/")).toBe(true);
    } finally {
      delete process.env.HONCHO_API_KEY;
      delete process.env.HONCHO_API_BASE_URL;
    }
  });
});
