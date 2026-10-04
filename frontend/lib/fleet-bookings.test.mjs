import test from "node:test";
import assert from "node:assert/strict";
import { getVehicleBookings } from "./fleet-bookings.ts";

const today = new Date(2026, 9, 4, 12);
const sale = { id: 1, vehicle_id: 4, state: "sale", date_order: "2026-10-04 09:00:00", commitment_date: "2026-10-06 09:00:00" };

test("drafts appear as quotations without becoming the fleet card's active rental", () => {
  const draft = { ...sale, state: "draft" };
  const result = getVehicleBookings(4, [draft], today);
  assert.equal(result.rental, null);
  assert.deepEqual(result.quotations, [draft]);
});

test("confirmed rental remains visible even when a newer quotation exists", () => {
  const draft = { ...sale, id: 2, state: "draft" };
  const result = getVehicleBookings(4, [draft, sale], today);
  assert.equal(result.rental.id, sale.id);
  assert.equal(result.quotations[0].id, draft.id);
});

test("confirmed Odoo quotation stays nonblocking until booking confirmation", () => {
  const result = getVehicleBookings(4, [{ ...sale, booking_status: "quotation" }], today);
  assert.equal(result.rental, null);
  assert.equal(result.quotations.length, 1);
});

test("returned, cancelled and other vehicles' bookings are ignored", () => {
  const result = getVehicleBookings(4, [
    { ...sale, returned: true }, { ...sale, state: "cancel" }, { ...sale, vehicle_id: 9 },
  ], today);
  assert.equal(result.rental, null);
  assert.deepEqual(result.quotations, []);
});

test("overdue rental is visible ahead of an upcoming booking", () => {
  const overdue = { ...sale, id: 2, commitment_date: "2026-10-03 09:00:00" };
  assert.equal(getVehicleBookings(4, [sale, overdue], today).rental.id, 2);
});

test("selection does not reorder the shared sales array", () => {
  const data = [{ ...sale, id: 2 }, sale];
  getVehicleBookings(4, data, today);
  assert.deepEqual(data.map(item => item.id), [2, 1]);
});
