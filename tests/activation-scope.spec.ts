import { afterEach, describe, expect, it, vi } from "vitest";
import plugin from "../src/worker.js";
import { createHonchoHarness, installFetchMock } from "./helpers.js";

afterEach(() => {
  vi.restoreAllMocks();
});

// Regression coverage for the activation failure on invocation-scope-enforcing
// hosts (Paperclip >= 2026.525.0):
//   Plugin "..." is not allowed to perform "companies.list":
//   the worker referenced a missing, expired, or unknown invocation scope
//
// These exercise the exact worker->host bridge calls (`companies.list` /
// `companies.get`) under the current SDK runtime that the host enforces scope on.
describe("activation / invocation-scope bridge path", () => {
  it("test-connection performs companies.list + companies.get and returns ok", async () => {
    installFetchMock();
    const harness = createHonchoHarness();

    await plugin.definition.setup(harness.ctx);

    const result = await harness.performAction<Record<string, unknown>>("test-connection", {});

    expect(result.ok).toBe(true);
    expect(result).toHaveProperty("workspaceId");
    expect(result).toHaveProperty("at");
  });

  it("companies.list bridge call resolves the seeded company through the host", async () => {
    installFetchMock();
    const harness = createHonchoHarness();

    const companies = await harness.ctx.companies.list({ limit: 1, offset: 0 });
    expect(companies[0]?.id).toBe("co_1");

    const company = await harness.ctx.companies.get("co_1");
    expect(company?.id).toBe("co_1");
  });
});
