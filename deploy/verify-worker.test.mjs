import test from "node:test";
import assert from "node:assert/strict";
import { verifyWorker } from "./verify-worker.mjs";

function config(environment) {
  const staging = environment === "staging";
  return {
    name: staging ? "prv-rental-os-staging" : "prv-rental-os",
    routes: [{pattern: staging ? "staging.rental-os.klynx.net" : "rental-os.klynx.net", custom_domain: true}],
    vars: {APP_ENV: environment, NEXT_PUBLIC_API_URL: staging ? "https://api-staging.rental-os.klynx.net" : "https://api.rental-os.klynx.net"},
    workers_dev: false, preview_urls: false,
  };
}
for (const environment of ["staging", "production"]) {
  test(environment + " correct configuration is accepted", () => verifyWorker(config(environment), environment));
  for (const field of ["name", "routes", "vars", "workers_dev", "preview_urls"]) {
    test(environment + " rejects incorrect " + field, () => {
      const bad = config(environment);
      bad[field] = field === "vars" ? {...bad.vars, NEXT_PUBLIC_API_URL: "https://wrong.example"} :
        field === "routes" ? [...bad.routes, {pattern:"other.example",custom_domain:true}] :
        field === "name" ? "wrong-worker" : true;
      assert.throws(() => verifyWorker(bad, environment));
    });
  }
}
test("unknown environments fail closed", () => assert.throws(() => verifyWorker(config("staging"), "preview")));

