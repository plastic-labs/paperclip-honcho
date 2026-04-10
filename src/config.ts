import type { PluginConfigValidationResult, PluginContext } from "@paperclipai/plugin-sdk";
import { DEFAULT_CONFIG } from "./constants.js";
import { isHonchoCloudBaseUrl } from "./deployment.js";
import type { HonchoPluginConfig, HonchoResolvedConfig } from "./types.js";

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  return value
    .map((item) => typeof item === "string" ? item.trim() : "")
    .filter((item) => item.length > 0);
}

function normalizeConfiguredBaseUrl(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_CONFIG.honchoApiBaseUrl;
  return value.trim();
}

export function resolveConfig(config: HonchoPluginConfig | Record<string, unknown> | null | undefined): HonchoResolvedConfig {
  const input = (config ?? {}) as HonchoPluginConfig;
  const legacyObserveAgentPeers = normalizeBoolean(input.observeAgentPeers, DEFAULT_CONFIG.observe_me);
  return {
    honchoApiBaseUrl: normalizeConfiguredBaseUrl(input.honchoApiBaseUrl),
    honchoApiKey: normalizeString(
      input.honchoApiKey,
      normalizeString(input.honchoApiKeySecretRef, DEFAULT_CONFIG.honchoApiKey),
    ),
    workspacePrefix: normalizeString(input.workspacePrefix, DEFAULT_CONFIG.workspacePrefix) || DEFAULT_CONFIG.workspacePrefix,
    syncIssueComments: normalizeBoolean(input.syncIssueComments, DEFAULT_CONFIG.syncIssueComments),
    syncIssueDocuments: normalizeBoolean(input.syncIssueDocuments, DEFAULT_CONFIG.syncIssueDocuments),
    enablePromptContext: normalizeBoolean(input.enablePromptContext, DEFAULT_CONFIG.enablePromptContext),
    enablePeerChat: normalizeBoolean(input.enablePeerChat, DEFAULT_CONFIG.enablePeerChat),
    observe_me: typeof input.observe_me === "boolean"
      ? input.observe_me
      : typeof input.observeMe === "boolean"
        ? input.observeMe
        : legacyObserveAgentPeers,
    observe_others: typeof input.observe_others === "boolean"
      ? input.observe_others
      : typeof input.observeOthers === "boolean"
        ? input.observeOthers
        : legacyObserveAgentPeers,
    noisePatterns: normalizeStringArray(input.noisePatterns, DEFAULT_CONFIG.noisePatterns),
    disableDefaultNoisePatterns: normalizeBoolean(input.disableDefaultNoisePatterns, DEFAULT_CONFIG.disableDefaultNoisePatterns),
    stripPlatformMetadata: normalizeBoolean(input.stripPlatformMetadata, DEFAULT_CONFIG.stripPlatformMetadata),
    flushBeforeReset: normalizeBoolean(input.flushBeforeReset, DEFAULT_CONFIG.flushBeforeReset),
  };
}

export async function getResolvedConfig(ctx: PluginContext): Promise<HonchoResolvedConfig> {
  return resolveConfig((await ctx.config.get()) as HonchoPluginConfig);
}

export function validateConfig(config: HonchoPluginConfig | Record<string, unknown> | HonchoResolvedConfig): PluginConfigValidationResult {
  const resolved = resolveConfig(config);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!resolved.honchoApiBaseUrl) {
    errors.push("Honcho base URL is required");
  } else {
    try {
      const parsed = new URL(resolved.honchoApiBaseUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        errors.push("Honcho base URL must use http or https");
      }
    } catch {
      errors.push("Honcho base URL must be a valid URL");
    }
  }

  if (isHonchoCloudBaseUrl(resolved.honchoApiBaseUrl) && !resolved.honchoApiKey) {
    errors.push("Honcho API key is required");
  }

  if (!resolved.syncIssueComments && !resolved.syncIssueDocuments) {
    warnings.push("Both syncIssueComments and syncIssueDocuments are disabled; the plugin will only serve connection checks and on-demand tools.");
  }
  if (resolved.enablePromptContext) {
    warnings.push("Automatic prompt injection requires a newer Paperclip host; this package currently supports manual prompt previews only.");
  }
  if (resolved.flushBeforeReset) {
    warnings.push("Flush-before-reset controls are inactive in the public-host-compatible Honcho package.");
  }

  return {
    ok: errors.length === 0,
    warnings: warnings.length > 0 ? warnings : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export function assertConfigured(config: HonchoResolvedConfig): void {
  const validation = validateConfig(config);
  if (!validation.ok) {
    throw new Error(validation.errors?.join("; ") ?? "Honcho config is invalid");
  }
}
