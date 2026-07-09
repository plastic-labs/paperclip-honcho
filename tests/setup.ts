import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Hermeticity: the local Honcho config fallback reads ~/.honcho/config.json via
// os.homedir(). Redirect HOME (which os.homedir() honors on POSIX) to a fresh,
// empty temp directory so the suite never reads the developer's real Honcho
// config. Tests that exercise the fallback write their own config under HOME.
const isolatedHome = mkdtempSync(join(tmpdir(), "honcho-test-home-"));
process.env.HOME = isolatedHome;
delete process.env.HERMES_HOME;
