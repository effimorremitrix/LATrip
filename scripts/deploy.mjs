#!/usr/bin/env node
/**
 * Deploy the Worker with the current commit stamped into it, and prove the
 * deploy landed.
 *
 * Three failures this script exists to prevent, all of which have happened:
 *
 *   1. Deploying a stale checkout. `git pull` reports "Already up to date" when
 *      you are on a branch that is not the one being merged into, so being up to
 *      date says nothing about being current. The guard compares HEAD against
 *      the tip of the remote default branch, after an actual fetch.
 *   2. Deploying into the wrong Cloudflare account. `account_id` in
 *      wrangler.toml pins it, and wrangler fails fast and loudly when the login
 *      cannot see that account. This script only checks the pin is still there.
 *   3. Believing a deploy that did not land. After deploying it reads
 *      /version back off the live Worker and compares. A stale deploy has been
 *      mistaken for a failed one before; this closes the loop in one step.
 *
 * Normal deploys come from Cloudflare Workers Builds on a push to the default
 * branch, where the checkout is by definition the pushed commit and the git
 * guards are skipped. Running it locally is the emergency path.
 *
 * Node rather than a shell one-liner so it behaves the same on Windows.
 *
 * Usage: npm run deploy [-- --force] [-- --check] [-- extra wrangler args]
 *        --force  deploy anyway when the guards object; for emergencies.
 *        --check  run the guards, print what would be deployed, then stop.
 *                 Nothing is uploaded. Use it to see whether you are clear to
 *                 deploy without finding out the hard way.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const LIVE_URL = (process.env.LATRIP_URL || "https://latrip.effi-mor-e04.workers.dev").replace(/\/$/, "");
const EFFI_ACCOUNT_ID = "e0492f11eda29c3c33b7962cff58418c";
const BEN_ACCOUNT_ID = "2837794c628d7bc604f09eab31d7d548";

const argv = process.argv.slice(2);
const force = argv.includes("--force");
const checkOnly = argv.includes("--check");
const passthrough = argv.filter((a) => a !== "--force" && a !== "--check");

/* Workers Builds sets WORKERS_CI. There the checkout is the commit that was
   pushed, so the branch guards are meaningless, and the clone can be shallow
   enough that they would fail on nothing. */
const inCI = process.env.WORKERS_CI === "1" || process.env.CI === "true";

function git(args, fallback = null) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return fallback;
  }
}

/* `overridable` is false for the account pin: deploying LATrip into the wrong
   Cloudflare account is never what anyone meant, so --force must not offer a
   way through it. Offering one in the message would be worse than not having
   it, because the next person would try it and lose a minute to nothing. */
function refuse(what, fix, overridable = true) {
  console.error("");
  console.error(`  REFUSING TO DEPLOY: ${what}`);
  console.error(`  ${fix}`);
  if (overridable) {
    console.error("");
    console.error("  Deploy anyway with:  npm run deploy -- --force");
  }
  console.error("");
  process.exit(1);
}

/* ---------- account ----------
 *
 * LATrip belongs in Effi's account; benmor2026.com and the ben-la-proxy Worker
 * in front of it belong in Ben's. The pin in wrangler.toml is what enforces
 * that at deploy time, so the only thing worth checking here is that the pin is
 * still the right one. */
{
  const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  if (toml.includes(BEN_ACCOUNT_ID)) {
    refuse(
      "wrangler.toml pins Ben's account id.",
      "LATrip belongs in Effi's account. Ben's account holds benmor2026.com and ben-la-proxy.",
      false
    );
  }
  if (!toml.includes(EFFI_ACCOUNT_ID)) {
    refuse(
      "wrangler.toml no longer pins Effi's account id.",
      `Restore  account_id = "${EFFI_ACCOUNT_ID}"  in wrangler.toml.`,
      false
    );
  }
}

/* ---------- what are we about to deploy ---------- */
let version;
if (inCI) {
  const sha = process.env.WORKERS_CI_COMMIT_SHA || git(["rev-parse", "HEAD"], "");
  version = sha ? sha.slice(0, 7) : "unknown";
} else {
  const sha = git(["rev-parse", "--short", "HEAD"]);
  if (!sha) refuse("this is not a git repository, so the commit cannot be stamped.", "Deploy from a clone.", false);
  const dirty = git(["status", "--porcelain"], "") !== "";

  /* Fetch first. The old version of this check read a stale remote ref, so it
     stayed quiet about a branch that was days behind. */
  const fetched = spawnSync("git", ["fetch", "--quiet", "origin"], { stdio: "ignore" }).status === 0;
  if (!fetched) {
    console.warn("  Note: could not reach the remote; the branch check below may be stale.");
  }
  spawnSync("git", ["remote", "set-head", "origin", "-a"], { stdio: "ignore" });

  const defaultRef = git(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
  const defaultSha = defaultRef ? git(["rev-parse", defaultRef]) : null;
  const headSha = git(["rev-parse", "HEAD"]);

  if (defaultSha && headSha !== defaultSha && !force) {
    const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], "?");
    refuse(
      `HEAD (${branch} at ${sha}) is not the tip of ${defaultRef}.`,
      `Run:  git checkout ${defaultRef.replace("origin/", "")} && git pull`
    );
  }
  if (dirty && !force) {
    refuse("the working tree has uncommitted changes.", "Commit them, or deploy a throwaway build with --force.");
  }

  version = dirty ? `${sha}-dirty` : sha;
  if (dirty) console.warn(`  Note: uncommitted changes present, deploying as ${version}.`);
}

const deployed = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

if (checkOnly) {
  console.log(`  Clear to deploy. Would deploy ${version} to ${LIVE_URL}.`);
  process.exit(0);
}

console.log(`Deploying ${version} (${deployed})`);

const result = spawnSync(
  "npx",
  ["--yes", "wrangler", "deploy", "--var", `APP_VERSION:${version}`, "--var", `APP_DEPLOYED:${deployed}`, ...passthrough],
  { stdio: "inherit", shell: process.platform === "win32" }
);
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);

/* ---------- did it actually land ----------
 *
 * Reading the version back is the whole point: a deploy that uploaded an old
 * checkout, or went to the wrong place, is otherwise indistinguishable from a
 * good one until someone notices the app is missing a feature. */
const deadline = Date.now() + 30_000;
let live = null;
for (;;) {
  try {
    const res = await fetch(`${LIVE_URL}/version`, { cache: "no-store" });
    if (res.ok) {
      live = await res.json();
      if (live.version === version) break;
    }
  } catch {
    /* propagation, or no network from here; the deadline decides */
  }
  if (Date.now() > deadline) break;
  await new Promise((r) => setTimeout(r, 2000));
}

if (live && live.version === version) {
  console.log(`\n  Verified live at ${LIVE_URL} : ${live.version} (${live.deployed})`);
} else if (live) {
  console.error(`\n  WARNING: ${LIVE_URL}/version still reports ${JSON.stringify(live.version)}, expected ${version}.`);
  console.error("  The upload succeeded, so this is either slow propagation or a deploy to somewhere else.");
  console.error(`  Check again:  curl ${LIVE_URL}/version`);
  process.exit(1);
} else {
  console.warn(`\n  Could not read ${LIVE_URL}/version to confirm. Check it yourself:`);
  console.warn(`    curl ${LIVE_URL}/version`);
}
