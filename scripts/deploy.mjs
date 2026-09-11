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
import { readFileSync } from "node:fs";

/* ---------- account guard ----------
 *
 * LATrip lives in Effi's Cloudflare account. benmor2026.com, and the
 * `ben-la-proxy` Worker in front of it, live in Ben's. Nothing about the two
 * Workers is symmetric: the proxy pins Ben's account id in its own
 * wrangler.toml, and this check is the other half of that pair, refusing to
 * push LATrip into Ben's account if a `wrangler login` ever lands there.
 *
 * It is a deny-list rather than an allow-list on purpose: it needs no account
 * id of Effi's in the repository, and it fails closed on the one mistake that
 * actually matters.
 */
const BEN_ACCOUNT_ID = "2837794c628d7bc604f09eab31d7d548";

function refuseBenAccount() {
  const fail = (why) => {
    console.error("");
    console.error("  REFUSING TO DEPLOY: this would target Ben's Cloudflare account.");
    console.error(`  ${why}`);
    console.error("");
    console.error("  LATrip belongs in Effi's account. Ben's account holds benmor2026.com");
    console.error("  and the ben-la-proxy Worker, which is deployed from proxy/ instead.");
    console.error("");
    process.exit(1);
  };

  if ((process.env.CLOUDFLARE_ACCOUNT_ID || "").trim() === BEN_ACCOUNT_ID) {
    fail("CLOUDFLARE_ACCOUNT_ID is set to Ben's account id.");
  }

  try {
    const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
    if (toml.includes(BEN_ACCOUNT_ID)) {
      fail("wrangler.toml pins Ben's account id.");
    }
  } catch {
    /* No wrangler.toml is wrangler's problem to report, not ours. */
  }

  /* Last case: no account id anywhere, so wrangler falls back to whichever
     account the current login can see. If that is only Ben's, stop. */
  const who = spawnSync("npx", ["--yes", "wrangler", "whoami"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const out = `${who.stdout || ""}${who.stderr || ""}`;
  const ids = out.match(/\b[0-9a-f]{32}\b/g) || [];
  if (ids.length > 0 && ids.every((id) => id === BEN_ACCOUNT_ID)) {
    fail("`wrangler whoami` sees Ben's account and no other.");
  }
}

refuseBenAccount();

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
