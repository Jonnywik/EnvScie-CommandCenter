import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Rebuilds the README GIF from the already-sanitized demo PNG.
 * It intentionally never connects to live command-center, operator, map, or incident data.
 */
const source = resolve(process.env.PREVIEW_SOURCE ?? "../docs/assets/command-center-demo.png");
const target = resolve(process.env.PREVIEW_TARGET ?? "../docs/assets/command-center-preview.gif");

if (!existsSync(source)) {
  throw new Error(`Preview source is missing: ${source}`);
}

mkdirSync(dirname(target), { recursive: true });

const filter = "zoompan=z='min(zoom+0.0013,1.04)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=30:s=640x360:fps=10";
const result = spawnSync(
  "ffmpeg",
  ["-y", "-loop", "1", "-i", source, "-vf", filter, "-t", "3", "-gifflags", "-offsetting", target],
  { stdio: "inherit" },
);

if (result.status !== 0) {
  throw new Error("GIF refresh failed. Install ffmpeg and confirm the sanitized source PNG is valid.");
}

console.log(`Refreshed README preview: ${target}`);
