import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * The shared local Honcho config used across Honcho integrations (Hermes,
 * Claude Code, opencode), checked in the same precedence order Hermes uses.
 *
 * This is only meaningful when the Paperclip host runs on the same machine as
 * the config — the supported self-hosted/local Paperclip deployment model. On
 * any host without the file, every reader here returns null/false and callers
 * fall through to the configured Paperclip secret reference.
 */
export function readLocalHonchoConfig(): { apiKey?: string; baseUrl?: string } | null {
  const candidates = [
    process.env.HERMES_HOME ? join(process.env.HERMES_HOME, "honcho.json") : null,
    join(homedir(), ".hermes", "honcho.json"),
    join(homedir(), ".honcho", "config.json"),
  ].filter((path): path is string => Boolean(path));
  for (const path of candidates) {
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
      const apiKey = typeof parsed.apiKey === "string" && parsed.apiKey.trim() ? parsed.apiKey.trim() : undefined;
      const baseUrl = typeof parsed.baseUrl === "string" && parsed.baseUrl.trim() ? parsed.baseUrl.trim() : undefined;
      if (apiKey || baseUrl) return { apiKey, baseUrl };
    } catch {
      // not present / unreadable / invalid JSON — try the next candidate
    }
  }
  return null;
}

export function hasLocalHonchoApiKey(): boolean {
  return Boolean(readLocalHonchoConfig()?.apiKey);
}
