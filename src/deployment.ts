import { DEFAULT_CONFIG } from "./constants.js";

export function normalizeBaseUrlForComparison(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  try {
    return new URL(trimmed).toString().replace(/\/+$/, "");
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

// By host, whatever the scheme, port or path, so that every spelling of the
// cloud URL needs an API key.
export function isHonchoCloudBaseUrl(baseUrl: string): boolean {
  try {
    return new URL(baseUrl.trim()).hostname === new URL(DEFAULT_CONFIG.honchoApiBaseUrl).hostname;
  } catch {
    return false;
  }
}
