import test from "node:test";
import assert from "node:assert/strict";
import { workspaceForPath } from "./workspaces.ts";

test("workspaces preserve existing and nested rental journeys", () => {
  for (const path of ["/dashboard", "/dashboard/rentals/23", "/dashboard/calendar", "/dashboard/customers/1", "/crm/leads/2", "/dashboard/crm/leads/2", "/dashboard/activities"]) {
    assert.equal(workspaceForPath(path), "rentals");
  }
});
test("vehicle and care deep links select Fleet; business figures select Management", () => {
  for (const path of ["/dashboard/fleet", "/dashboard/fleet-care", "/dashboard/fleet/15"]) assert.equal(workspaceForPath(path), "fleet");
  assert.equal(workspaceForPath("/dashboard/analytics"), "management");
  assert.equal(workspaceForPath("/dashboard/fleet-other"), "rentals");
});
