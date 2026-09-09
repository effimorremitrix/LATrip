#!/usr/bin/env node
/**
 * Deploy the Worker with the current commit stamped into it.
 *
 * Without this, a running Worker cannot tell you which commit it is, so a stale
 * deploy looks exactly like a broken one. After deploying, GET /version answers
 * the question in one request.
 *
 * Node rather than a shell one-liner so it behaves the same on Windows.
 *
 * Usage: npm run deploy [-- extra wrangler args]
 */

import { execFileSync, spawnSync } from "node:child_process";

function git(args, fallback = null) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return fallback;
  }
}

/* Version: the short SHA, marked dirty when the tree has uncommitted changes, so
   a deploy of work-in-progress is labelled as such rather than claiming to be the
   commit it was branched from. */
const sha = git(["rev-parse", "--short", "HEAD"]);
if (!sha) {
  console.error("Not a git repository, or git is unavailable. Deploying without a version stamp.");
}
const dirty = sha && git(["status", "--porcelain"], "") !== "";
const version = sha ? (dirty ? `${sha}-dirty` : sha) : "unknown";
const deployed = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

/* The failure this whole script exists to prevent: deploying a clone that is
   behind its remote. Warn, never block; sometimes deploying an older commit is
   deliberate. No fetch, so this is only as fresh as the last one. */
const behind = Number(git(["rev-list", "--count", "HEAD..@{u}"], "0"));
if (Number.isFinite(behind) && behind > 0) {
  console.warn("");
  console.warn(`  WARNING: this branch is ${behind} commit(s) behind its remote.`);
  console.warn("  You are about to deploy code that is not the latest.");
  console.warn("  Run `git pull` first unless that is what you meant.");
  console.warn("");
}
if (dirty) {
  console.warn(`  Note: uncommitted changes present, deploying as ${version}.`);
}

console.log(`Deploying ${version} (${deployed})`);

const passthrough = process.argv.slice(2);
const result = spawnSync(
  "npx",
  [
    "--yes",
    "wrangler",
    "deploy",
    "--var",
    `APP_VERSION:${version}`,
    "--var",
    `APP_DEPLOYED:${deployed}`,
    ...passthrough,
  ],
  { stdio: "inherit", shell: process.platform === "win32" }
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
