import { DEFAULT_CONFIG } from "../constants.js";
import { isHonchoCloudBaseUrl } from "../deployment.js";
import type { HonchoResolvedConfig } from "../types.js";

export type SettingsConfig = HonchoResolvedConfig;
export type HonchoDeploymentMode = "cloud" | "self-hosted";

export function normalizeSettingsConfig(configJson: Record<string, unknown> | null | undefined): SettingsConfig {
  const source = configJson ?? {};
  return {
    honchoApiBaseUrl: typeof source.honchoApiBaseUrl === "string"
      ? source.honchoApiBaseUrl.trim()
      : DEFAULT_CONFIG.honchoApiBaseUrl,
    honchoApiKey: typeof source.honchoApiKey === "string"
      ? source.honchoApiKey.trim()
      : typeof source.honchoApiKeySecretRef === "string"
        ? source.honchoApiKeySecretRef.trim()
        : DEFAULT_CONFIG.honchoApiKey,
    workspacePrefix: typeof source.workspacePrefix === "string" ? source.workspacePrefix : DEFAULT_CONFIG.workspacePrefix,
    syncIssueComments: typeof source.syncIssueComments === "boolean" ? source.syncIssueComments : DEFAULT_CONFIG.syncIssueComments,
    syncIssueDocuments: typeof source.syncIssueDocuments === "boolean" ? source.syncIssueDocuments : DEFAULT_CONFIG.syncIssueDocuments,
    enablePromptContext: typeof source.enablePromptContext === "boolean" ? source.enablePromptContext : DEFAULT_CONFIG.enablePromptContext,
    enablePeerChat: typeof source.enablePeerChat === "boolean" ? source.enablePeerChat : DEFAULT_CONFIG.enablePeerChat,
    observe_me: typeof source.observe_me === "boolean"
      ? source.observe_me
      : typeof source.observeMe === "boolean"
        ? source.observeMe
        : typeof source.observeAgentPeers === "boolean"
          ? source.observeAgentPeers
          : DEFAULT_CONFIG.observe_me,
    observe_others: typeof source.observe_others === "boolean"
      ? source.observe_others
      : typeof source.observeOthers === "boolean"
        ? source.observeOthers
      : typeof source.observeAgentPeers === "boolean"
        ? source.observeAgentPeers
        : DEFAULT_CONFIG.observe_others,
    noisePatterns: Array.isArray(source.noisePatterns)
      ? source.noisePatterns.filter((value): value is string => typeof value === "string")
      : [...DEFAULT_CONFIG.noisePatterns],
    disableDefaultNoisePatterns: typeof source.disableDefaultNoisePatterns === "boolean" ? source.disableDefaultNoisePatterns : DEFAULT_CONFIG.disableDefaultNoisePatterns,
    stripPlatformMetadata: typeof source.stripPlatformMetadata === "boolean" ? source.stripPlatformMetadata : DEFAULT_CONFIG.stripPlatformMetadata,
    flushBeforeReset: typeof source.flushBeforeReset === "boolean" ? source.flushBeforeReset : DEFAULT_CONFIG.flushBeforeReset,
  };
}

export function getDeploymentMode(config: Pick<SettingsConfig, "honchoApiBaseUrl">): HonchoDeploymentMode {
  return isHonchoCloudBaseUrl(config.honchoApiBaseUrl) ? "cloud" : "self-hosted";
}
