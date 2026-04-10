import { DEFAULT_CONFIG } from "./constants.js";

export function normalizeBaseUrlForComparison(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function isHonchoCloudBaseUrl(baseUrl: string): boolean {
  return normalizeBaseUrlForComparison(baseUrl) === normalizeBaseUrlForComparison(DEFAULT_CONFIG.honchoApiBaseUrl);
}
