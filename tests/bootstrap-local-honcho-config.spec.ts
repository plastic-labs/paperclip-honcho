import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import plugin from "../src/worker.js";
import { createHonchoHarness } from "./helpers.js";

// Hermetic home directory so the test never touches the developer's real
// ~/.honcho/config.json.
let fakeHome: string;

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, homedir: () => fakeHome };
});

function sharedConfigPath(): string {
  return join(fakeHome, ".honcho", "config.json");
}

describe("bootstrapping the shared ~/.honcho/config.json", () => {
  beforeEach(() => {
    fakeHome = mkdtempSync(join(tmpdir(), "honcho-home-"));
  });

  afterEach(() => {
    rmSync(fakeHome, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("does nothing when the flag is off (default)", async () => {
    const harness = createHonchoHarness({
      config: {
        honchoApiKey: "some-key",
        bootstrapLocalHonchoConfig: false,
      },
    });

    await plugin.definition.setup(harness.ctx);

    expect(existsSync(sharedConfigPath())).toBe(false);
  });

  it("writes the file on setup when the flag is on and no local config exists", async () => {
    const harness = createHonchoHarness({
      config: {
        honchoApiBaseUrl: "http://127.0.0.1:8000",
        honchoApiKey: "some-key",
        bootstrapLocalHonchoConfig: true,
      },
    });

    await plugin.definition.setup(harness.ctx);

    expect(existsSync(sharedConfigPath())).toBe(true);
    const written = JSON.parse(readFileSync(sharedConfigPath(), "utf8"));
    expect(written).toEqual({ apiKey: "some-key", baseUrl: "http://127.0.0.1:8000" });
  });

  it("never overwrites an existing local config file", async () => {
    mkdirSync(join(fakeHome, ".honcho"), { recursive: true });
    writeFileSync(sharedConfigPath(), JSON.stringify({ apiKey: "developer-own-key" }));

    const harness = createHonchoHarness({
      config: {
        honchoApiKey: "company-key-should-not-clobber",
        bootstrapLocalHonchoConfig: true,
      },
    });

    await plugin.definition.setup(harness.ctx);

    const written = JSON.parse(readFileSync(sharedConfigPath(), "utf8"));
    expect(written).toEqual({ apiKey: "developer-own-key" });
  });

  it("writes the file from onConfigChanged without requiring a worker restart", async () => {
    const harness = createHonchoHarness({
      config: {
        honchoApiKey: "",
        bootstrapLocalHonchoConfig: true,
      },
    });

    await plugin.definition.setup(harness.ctx);
    expect(existsSync(sharedConfigPath())).toBe(false);

    await plugin.definition.onConfigChanged?.({
      honchoApiBaseUrl: "http://127.0.0.1:8000",
      honchoApiKey: "new-key-from-save",
      bootstrapLocalHonchoConfig: true,
    });

    expect(existsSync(sharedConfigPath())).toBe(true);
    const written = JSON.parse(readFileSync(sharedConfigPath(), "utf8"));
    expect(written).toEqual({ apiKey: "new-key-from-save", baseUrl: "http://127.0.0.1:8000" });
  });

  it("does not write when no API key is configured", async () => {
    const harness = createHonchoHarness({
      config: {
        honchoApiKey: "",
        bootstrapLocalHonchoConfig: true,
      },
    });

    await plugin.definition.setup(harness.ctx);

    expect(existsSync(sharedConfigPath())).toBe(false);
  });
});
