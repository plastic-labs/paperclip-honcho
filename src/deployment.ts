import { DEFAULT_CONFIG } from "./constants.js";

export function normalizeBaseUrlForComparison(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  try {
    return new URL(trimmed).toString().replace(/\/+$/, "");
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

export function isHonchoCloudBaseUrl(baseUrl: string): boolean {
  return normalizeBaseUrlForComparison(baseUrl) === normalizeBaseUrlForComparison(DEFAULT_CONFIG.honchoApiBaseUrl);
}
