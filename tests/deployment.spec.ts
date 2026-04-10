import { describe, expect, it } from "vitest";
import { isHonchoCloudBaseUrl, normalizeBaseUrlForComparison } from "../src/deployment.js";

describe("deployment helpers", () => {
  it("normalizes trailing slashes before comparing Honcho base URLs", () => {
    expect(normalizeBaseUrlForComparison(" https://api.honcho.dev/ ")).toBe("https://api.honcho.dev");
  });

  it("normalizes default HTTPS ports and host casing before comparing cloud URLs", () => {
    expect(normalizeBaseUrlForComparison("HTTPS://API.HONCHO.DEV:443/")).toBe("https://api.honcho.dev");
  });

  it("normalizes default HTTP ports before comparing base URLs", () => {
    expect(normalizeBaseUrlForComparison("http://api.honcho.dev:80/")).toBe("http://api.honcho.dev");
  });

  it("treats the default cloud base URL as cloud even when saved with a trailing slash", () => {
    expect(isHonchoCloudBaseUrl("https://api.honcho.dev/")).toBe(true);
  });

  it("treats equivalent cloud URLs as cloud even when they include the default port or uppercase host casing", () => {
    expect(isHonchoCloudBaseUrl("HTTPS://API.HONCHO.DEV:443/")).toBe(true);
  });
});
