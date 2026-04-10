import { describe, expect, it } from "vitest";
import { isHonchoCloudBaseUrl, normalizeBaseUrlForComparison } from "../src/deployment.js";

describe("deployment helpers", () => {
  it("normalizes trailing slashes before comparing Honcho base URLs", () => {
    expect(normalizeBaseUrlForComparison(" https://api.honcho.dev/ ")).toBe("https://api.honcho.dev");
  });

  it("treats the default cloud base URL as cloud even when saved with a trailing slash", () => {
    expect(isHonchoCloudBaseUrl("https://api.honcho.dev/")).toBe(true);
  });
});
