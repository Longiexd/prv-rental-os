import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function verifyWorker(config, environment) {
  assert.ok(["staging", "production"].includes(environment), "Unknown environment");
  const staging = environment === "staging";
  const host = staging ? "staging.rental-os.klynx.net" : "rental-os.klynx.net";
  const api = staging ? "https://api-staging.rental-os.klynx.net" : "https://api.rental-os.klynx.net";
  assert.equal(config.name, staging ? "prv-rental-os-staging" : "prv-rental-os", "Wrong Worker target");
  assert.equal(config.vars?.APP_ENV, environment, "Wrong APP_ENV");
  assert.equal(config.vars?.NEXT_PUBLIC_API_URL, api, "Wrong API URL");
  assert.deepEqual(config.routes, [{ pattern: host, custom_domain: true }], "Unexpected domain bindings");
  assert.equal(config.workers_dev, false, "workers.dev must not bypass domain protection");
  assert.equal(config.preview_urls, false, "Preview URLs must not bypass domain protection");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const environment = process.argv[2];
  const file = process.argv[3] ?? "frontend/dist/server/wrangler.json";
  verifyWorker(JSON.parse(readFileSync(file, "utf8")), environment);
  console.log("Verified Worker isolation: " + environment);
}

