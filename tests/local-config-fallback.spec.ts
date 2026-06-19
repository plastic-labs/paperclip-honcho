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

  it("prefers a resolvable Paperclip secret over the local config", async () => {
    writeLocalHonchoConfig({ apiKey: "local-key-should-lose" });
    const { requests } = installFetchMock();
    const harness = createHonchoHarness({
      config: {
        honchoApiBaseUrl: "http://127.0.0.1:8000",
        honchoApiKey: "HONCHO_API_KEY",
        useLocalHonchoConfig: true,
      },
    });

    await plugin.definition.setup(harness.ctx);
    await harness.performAction("test-connection");

    const workspaceRequest = requestsMatching(requests, "/v3/workspaces")[0];
    expect(workspaceRequest?.headers.authorization).toBe("Bearer resolved:HONCHO_API_KEY");
  });
});
