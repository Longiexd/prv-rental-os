export type FleetBooking = {
  id: number;
  vehicle_id?: number | null;
  state: string;
  booking_status?: "quotation" | "confirmed" | "cancelled";
  picked_up?: boolean;
  returned?: boolean;
  date_order: string | null;
  commitment_date: string | null;
};

function isQuotation(sale: FleetBooking) {
  return sale.booking_status === "quotation" || sale.state === "draft" || sale.state === "sent";
}

export function getVehicleBookings<T extends FleetBooking>(vehicleId: number, sales: T[], now = new Date()) {
  const relevant = sales.filter(sale => sale.vehicle_id === vehicleId &&
    sale.state !== "cancel" && sale.booking_status !== "cancelled" && !sale.returned);
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  function priority(sale: T) {
    const start = sale.date_order?.slice(0, 10);
    const end = sale.commitment_date?.slice(0, 10);
    if (end && end < today) return 0;
    if (sale.picked_up) return 1;
    if (start && end && start <= today && today <= end) return 2;
    return start && start > today ? 3 : 4;
  }
  const confirmed = relevant.filter(sale => !isQuotation(sale) &&
    (sale.booking_status === "confirmed" || sale.state === "sale" || sale.state === "done"));
  confirmed.sort((a, b) => priority(a) - priority(b) ||
    (a.date_order || "").localeCompare(b.date_order || "") || a.id - b.id);
  const quotations = relevant.filter(isQuotation).sort((a, b) =>
    (a.date_order || "").localeCompare(b.date_order || "") || a.id - b.id);
  return { rental: confirmed[0] || null, quotations };
}
