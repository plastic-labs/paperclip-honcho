import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../src/constants.js";
import { getDeploymentMode, normalizeSettingsConfig } from "../src/ui/settings-config.js";

describe("settings UI config helpers", () => {
  it("preserves a saved custom Honcho base URL", () => {
    const resolved = normalizeSettingsConfig({
      honchoApiBaseUrl: " http://127.0.0.1:8000/ ",
      honchoApiKeySecretRef: "HONCHO_API_KEY",
    });

    expect(resolved.honchoApiBaseUrl).toBe("http://127.0.0.1:8000/");
  });

  it("preserves an explicitly empty Honcho base URL for self-hosted validation", () => {
    const resolved = normalizeSettingsConfig({
      honchoApiBaseUrl: "   ",
      honchoApiKeySecretRef: "HONCHO_API_KEY",
    });

    expect(resolved.honchoApiBaseUrl).toBe("");
    expect(getDeploymentMode(resolved)).toBe("self-hosted");
  });

  it("treats the default base URL as Honcho Cloud", () => {
    expect(getDeploymentMode({
      honchoApiBaseUrl: DEFAULT_CONFIG.honchoApiBaseUrl,
    })).toBe("cloud");
  });

  it("treats a non-default base URL as self-hosted or local", () => {
    const resolved = normalizeSettingsConfig({
      honchoApiBaseUrl: "http://host.docker.internal:8000",
      honchoApiKeySecretRef: "HONCHO_API_KEY",
    });

    expect(getDeploymentMode(resolved)).toBe("self-hosted");
  });
});
