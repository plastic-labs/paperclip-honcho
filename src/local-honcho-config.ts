import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

function sharedHonchoConfigPath(): string {
  return join(homedir(), ".honcho", "config.json");
}

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

/**
 * Seeds the shared ~/.honcho/config.json (used by Hermes, Claude Code, and
 * opencode) with this plugin's resolved Honcho credentials — the same kind of
 * explicit "persist to ~/.honcho/config.json" setup action those tools
 * already expose, triggered here from the plugin's own setup/config-save
 * lifecycle instead of a manual command.
 *
 * Write-if-absent only: never overwrites an existing file. That's what makes
 * this safe to call from a shared, multi-company worker process — the worst
 * case is "first caller to run wins, nobody's config gets clobbered" rather
 * than a later company's config silently overwriting an earlier one's.
 *
 * Stored as plaintext JSON, matching the format every other reader/writer of
 * this shared file already uses — there is no separate encrypted-secret
 * channel to defer to here, so there is nothing to encrypt against.
 */
export function bootstrapLocalHonchoConfig(credentials: { apiKey: string; baseUrl?: string }): void {
  if (!credentials.apiKey) return;
  if (readLocalHonchoConfig()) return;

  const path = sharedHonchoConfigPath();
  if (existsSync(path)) return;

  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      JSON.stringify({ apiKey: credentials.apiKey, baseUrl: credentials.baseUrl }, null, 2),
      { mode: 0o600 },
    );
  } catch {
    // Best-effort convenience only — never block plugin startup or a config
    // save on a filesystem write failure.
  }
}
