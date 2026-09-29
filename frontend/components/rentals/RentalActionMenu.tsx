"use client";

import { MoreVertical, Phone, Check, X, XCircle, Eye, Clock } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type ActionSale = {
  id: number;
  vehicle_id?: number | null;
  picked_up?: boolean;
  returned?: boolean;
};

export function RentalActionMenu({
  sale,
  kind,
  onPickedUp,
  onCancel,
  onReturn,
}: {
  sale: ActionSale;
  kind: "pickup" | "return" | "overdue";
  onPickedUp?: (saleId: number) => void;
  onCancel?: (saleId: number) => void;
  onReturn?: (vehicleId: number, nextState: "Nettoyage" | "Disponible") => void;
}) {
  const [open, setOpen] = useState(false);
  const [subMenu, setSubMenu] = useState<"none" | "not-picked-up" | "not-returned">("none");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
        setSubMenu("none");
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  function close() {
    setOpen(false);
    setSubMenu("none");
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        aria-label="Rental actions"
        onClick={(event) => {
          event.preventDefault();
          setOpen((value) => !value);
          setSubMenu("none");
        }}
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-surface-secondary hover:text-text"
      >
        <MoreVertical size={15} />
      </button>

      {open && (
        <div
          onClick={(event) => event.preventDefault()}
          className="absolute right-0 top-8 z-20 w-56 overflow-hidden rounded-lg border border-border bg-surface py-1 text-sm shadow-xl"
        >
          {subMenu === "none" && (
            <>
              <Link href={`/dashboard/rentals/${sale.id}`} onClick={close} className="flex items-center gap-2 px-3 py-2 text-text-secondary hover:bg-surface-secondary hover:text-text">
                <Eye size={14} /> View rental
              </Link>

              {kind === "pickup" && !sale.picked_up && (
                <>
                  <button type="button" onClick={() => { onPickedUp?.(sale.id); close(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-lime-ink hover:bg-lime/10">
                    <Check size={14} /> Picked up
                  </button>
                  <button type="button" onClick={() => setSubMenu("not-picked-up")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-text-secondary hover:bg-surface-secondary hover:text-text">
                    <X size={14} /> Not picked up
                  </button>
                </>
              )}

              {(kind === "return" || kind === "overdue") && !sale.returned && sale.vehicle_id && (
                <>
                  <button type="button" onClick={() => { onReturn?.(sale.vehicle_id!, "Nettoyage"); close(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-lime-ink hover:bg-lime/10">
                    <Check size={14} /> Returned · send to cleaning
                  </button>
                  <button type="button" onClick={() => { onReturn?.(sale.vehicle_id!, "Disponible"); close(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-lime-ink hover:bg-lime/10">
                    <Check size={14} /> Returned · ready now
                  </button>
                  <button type="button" onClick={() => setSubMenu("not-returned")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-text-secondary hover:bg-surface-secondary hover:text-text">
                    <Clock size={14} /> Not returned yet
                  </button>
                </>
              )}

              {onCancel && (
                <button type="button" onClick={() => { if (window.confirm("Cancel this booking?")) { onCancel(sale.id); } close(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-danger hover:bg-danger/10">
                  <XCircle size={14} /> Cancel booking
                </button>
              )}
            </>
          )}

          {subMenu === "not-picked-up" && (
            <>
              <p className="px-3 py-1.5 text-xs text-muted">Customer hasn&apos;t shown up yet</p>
              <Link href={`/dashboard/rentals/${sale.id}#follow-ups`} onClick={close} className="flex w-full items-center gap-2 px-3 py-2 text-left text-text-secondary hover:bg-surface-secondary hover:text-text">
                <Phone size={14} /> Schedule a call
              </Link>
              {onCancel && (
                <button type="button" onClick={() => { if (window.confirm("Cancel this booking?")) { onCancel(sale.id); } close(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-danger hover:bg-danger/10">
                  <XCircle size={14} /> Cancel booking
                </button>
              )}
            </>
          )}

          {subMenu === "not-returned" && (
            <>
              <p className="px-3 py-1.5 text-xs text-muted">Extension in progress?</p>
              <Link href={`/dashboard/rentals/${sale.id}?edit=1`} onClick={close} className="flex w-full items-center gap-2 px-3 py-2 text-left text-text-secondary hover:bg-surface-secondary hover:text-text">
                <Clock size={14} /> Extend booking (new days)
              </Link>
              <Link href={`/dashboard/rentals/${sale.id}#payments`} onClick={close} className="flex w-full items-center gap-2 px-3 py-2 text-left text-text-secondary hover:bg-surface-secondary hover:text-text">
                <Clock size={14} /> Invoice extra hours
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
