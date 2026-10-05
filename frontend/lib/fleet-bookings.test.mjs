import test from "node:test";
import assert from "node:assert/strict";
import { getVehicleBookings, buildReturnPayload, odometerUnit } from "./fleet-bookings.ts";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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


const form = { orderId: "42", odometer: "12500", nextState: "Nettoyage", returnNotes: " All checked ", damageNotes: "" };
test("return carries the selected booking, mileage, notes and chosen operational state", () => {
  assert.deepEqual(buildReturnPayload(form, 12000), { order_id: 42, odometer: 12500,
    next_state: "Nettoyage", return_notes: "All checked", damage_notes: "" });
});
test("blank, decreasing and non-finite odometer readings cannot submit", () => {
  for (const odometer of ["", " ", "11999", "-1", "Infinity", "NaN", "not a number"]) {
    assert.throws(() => buildReturnPayload({ ...form, odometer }, 12000));
  }
});
test("equal reading is valid for a retry or a rental with no distance travelled", () => {
  assert.equal(buildReturnPayload(form, 12500).odometer, 12500);
  assert.equal(buildReturnPayload({ ...form, odometer: "0" }, 0).odometer, 0);
});
test("missing or invalid booking selection cannot return a different booking implicitly", () => {
  for (const orderId of ["", "0", "-1", "1.5", "NaN"]) assert.throws(() => buildReturnPayload({ ...form, orderId }, 12000));
});
test("notes remain plain text and are bounded", () => {
  assert.equal(buildReturnPayload({ ...form, damageNotes: "<script>not markup</script>" }, 12000).damage_notes, "<script>not markup</script>");
  assert.throws(() => buildReturnPayload({ ...form, returnNotes: "x".repeat(4001) }, 12000));
});
test("odometer unit follows the vehicle instead of converting its reading", () => {
  assert.equal(odometerUnit("kilometers"), "km");
  assert.equal(odometerUnit("miles"), "mi");
});
test("a legacy pending return with no mileage resumes its saved values", () => {
  const pending = { status: "pending", order_id: 42, odometer: null,
    next_state: "Maintenance", return_notes: "Saved", damage_notes: "Scratch" };
  assert.deepEqual(buildReturnPayload({ ...form, odometer: "" }, 12000, pending), {
    order_id: 42, odometer: null, next_state: "Maintenance", return_notes: "Saved", damage_notes: "Scratch",
  });
});
test("a pending return cannot switch booking or lower an advanced reading", () => {
  const pending = { status: "pending", order_id: 43, odometer: 12500 };
  assert.throws(() => buildReturnPayload(form, 12000, pending));
  assert.throws(() => buildReturnPayload(form, 13000, { ...pending, order_id: 42 }));
});
test("invalid saved vehicle mileage is rejected", () => {
  for (const reading of [-1, NaN, Infinity]) assert.throws(() => buildReturnPayload(form, reading));
});


const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const theme = readFileSync(resolve(root, "styles/theme.css"), "utf8");
const globals = readFileSync(resolve(root, "app/globals.css"), "utf8");
const light = theme.slice(theme.indexOf('html[data-theme="light"]'));
const palette = Object.fromEntries([...light.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map(match => [match[1], match[2]]));

function contrast(a, b) {
  const luminance = hex => {
    const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}

test("shared light-mode text and accent tokens meet 4.5:1 on page/card/form surfaces", () => {
  for (const foreground of ["text", "text-secondary", "muted", "lime-ink", "pink-ink", "blue-ink", "violet-ink", "orange-ink", "red-ink"])
    for (const background of ["background", "surface", "surface-secondary"])
      assert.ok(contrast(palette[foreground], palette[background]) >= 4.5, `${foreground} on ${background}`);
});

test("every semantic status and to-do token has readable light-mode text", () => {
  for (const name of ["available", "reserved", "rented", "cleaning", "maintenance", "danger"])
    assert.ok(contrast(palette[`status-${name}-text`], palette[`status-${name}-bg`]) >= 4.5, name);
  assert.ok(contrast(palette["todo-text"], palette["todo-bg"]) >= 4.5);
  assert.ok(contrast(palette["todo-fill-text"], palette["todo-fill"]) >= 4.5);
});

function sources(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sources(path) : /\.tsx?$/.test(entry.name) ? [readFileSync(path, "utf8")] : [];
  });
}

test("legacy colored text across all app pages/components has a light-mode override", () => {
  const content = [...sources(resolve(root, "app")), ...sources(resolve(root, "components"))].join("\n");
  const classes = new Set(content.match(/text-(?:green|blue|yellow|amber|orange|violet|red|zinc)-\d+(?:\/\d+)?/g));
  assert.ok(classes.size > 0);
  for (const name of classes) assert.ok(globals.includes(`.${name.replaceAll("/", "\\/")}`), `Missing override: ${name}`);
});

test("booking progress explicitly uses black text in light mode and blue action fills stay legible", () => {
  assert.match(globals, /html\[data-theme="light"\] \.klynx-booking-progress li\s*\{\s*color: #111113;/);
  assert.ok(contrast("#111113", "#3B82F6") >= 4.5);
  assert.ok(contrast("#111113", "#C8F065") >= 4.5);
});
