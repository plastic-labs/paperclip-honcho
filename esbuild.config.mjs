import esbuild from "esbuild";
import { createPluginBundlerPresets } from "@paperclipai/plugin-sdk/bundlers";

const presets = createPluginBundlerPresets({ uiEntry: "src/ui/index.tsx" });
const watch = process.argv.includes("--watch");

const workerCtx = await esbuild.context(presets.esbuild.worker);
const workerBootstrapCtx = await esbuild.context({
  bundle: true,
  platform: "node",
  format: "esm",
  sourcemap: true,
  entryPoints: ["src/worker-bootstrap.ts"],
  outfile: "dist/worker-bootstrap.js",
});
const { outdir: _manifestOutdir, ...manifestBase } = presets.esbuild.manifest;
const manifestCtx = await esbuild.context({
  ...manifestBase,
  bundle: true,
  platform: "node",
  format: "esm",
  entryPoints: ["src/manifest.ts"],
  outfile: "dist/manifest.js",
});
const constantsCtx = await esbuild.context({
  bundle: true,
  platform: "node",
  format: "esm",
  sourcemap: true,
  entryPoints: ["src/constants.ts"],
  outfile: "dist/constants.js",
});
const uiCtx = await esbuild.context(presets.esbuild.ui);

if (watch) {
  await Promise.all([workerCtx.watch(), workerBootstrapCtx.watch(), manifestCtx.watch(), constantsCtx.watch(), uiCtx.watch()]);
  console.log("esbuild watch mode enabled for worker, worker bootstrap, manifest, constants, and ui");
} else {
  await Promise.all([workerCtx.rebuild(), workerBootstrapCtx.rebuild(), manifestCtx.rebuild(), constantsCtx.rebuild(), uiCtx.rebuild()]);
  await Promise.all([workerCtx.dispose(), workerBootstrapCtx.dispose(), manifestCtx.dispose(), constantsCtx.dispose(), uiCtx.dispose()]);
}
