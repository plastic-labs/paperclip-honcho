import { DEFAULT_CONFIG } from "../constants.js";
import type { HonchoResolvedConfig } from "../types.js";

export type SettingsConfig = HonchoResolvedConfig;
export type HonchoDeploymentMode = "cloud" | "self-hosted";

export function normalizeSettingsConfig(configJson: Record<string, unknown> | null | undefined): SettingsConfig {
  const source = configJson ?? {};
  return {
    honchoApiBaseUrl: typeof source.honchoApiBaseUrl === "string"
      ? source.honchoApiBaseUrl.trim() || DEFAULT_CONFIG.honchoApiBaseUrl
      : DEFAULT_CONFIG.honchoApiBaseUrl,
    honchoApiKeySecretRef: typeof source.honchoApiKeySecretRef === "string" ? source.honchoApiKeySecretRef : DEFAULT_CONFIG.honchoApiKeySecretRef,
    workspacePrefix: typeof source.workspacePrefix === "string" ? source.workspacePrefix : DEFAULT_CONFIG.workspacePrefix,
    syncIssueComments: typeof source.syncIssueComments === "boolean" ? source.syncIssueComments : DEFAULT_CONFIG.syncIssueComments,
    syncIssueDocuments: typeof source.syncIssueDocuments === "boolean" ? source.syncIssueDocuments : DEFAULT_CONFIG.syncIssueDocuments,
    enablePromptContext: typeof source.enablePromptContext === "boolean" ? source.enablePromptContext : DEFAULT_CONFIG.enablePromptContext,
    enablePeerChat: typeof source.enablePeerChat === "boolean" ? source.enablePeerChat : DEFAULT_CONFIG.enablePeerChat,
    observeMe: typeof source.observeMe === "boolean"
      ? source.observeMe
      : typeof source.observeAgentPeers === "boolean"
        ? source.observeAgentPeers
        : DEFAULT_CONFIG.observeMe,
    observeOthers: typeof source.observeOthers === "boolean"
      ? source.observeOthers
      : typeof source.observeAgentPeers === "boolean"
        ? source.observeAgentPeers
        : DEFAULT_CONFIG.observeOthers,
    noisePatterns: Array.isArray(source.noisePatterns)
      ? source.noisePatterns.filter((value): value is string => typeof value === "string")
      : [...DEFAULT_CONFIG.noisePatterns],
    disableDefaultNoisePatterns: typeof source.disableDefaultNoisePatterns === "boolean" ? source.disableDefaultNoisePatterns : DEFAULT_CONFIG.disableDefaultNoisePatterns,
    stripPlatformMetadata: typeof source.stripPlatformMetadata === "boolean" ? source.stripPlatformMetadata : DEFAULT_CONFIG.stripPlatformMetadata,
    flushBeforeReset: typeof source.flushBeforeReset === "boolean" ? source.flushBeforeReset : DEFAULT_CONFIG.flushBeforeReset,
  };
}

export function getDeploymentMode(config: Pick<SettingsConfig, "honchoApiBaseUrl">): HonchoDeploymentMode {
  return config.honchoApiBaseUrl === DEFAULT_CONFIG.honchoApiBaseUrl ? "cloud" : "self-hosted";
}
