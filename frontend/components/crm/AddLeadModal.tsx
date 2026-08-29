"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  UserRound,
  X,
} from "lucide-react";

type AddLeadModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

type CustomerMatch = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  is_customer: boolean;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.rental-os.klynx.net";

export default function AddLeadModal({
  open,
  onClose,
  onCreated,
}: AddLeadModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");

  const [matches, setMatches] = useState<CustomerMatch[]>([]);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerMatch | null>(null);

  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ============================================================
  // NORMALIZE NAME
  // ============================================================
  //
  // Used only for frontend duplicate matching.
  //
  // This means:
  //
  // "Ahmed Ben Ali"
  // "ahmed ben ali"
  // "AHMED BEN ALI"
  // " Ahmed   Ben Ali "
  //
  // all normalize to the same value.
  //
  // Odoo's `ilike` search is already case-insensitive, but this
  // gives the frontend an exact normalized comparison as well.
  // ============================================================

  function normalizeName(value: string) {
    return value
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase();
  }

  // ============================================================
  // RESET
  // ============================================================

  function resetForm() {
    setName("");
    setPhone("");
    setEmail("");
    setDescription("");

    setMatches([]);
    setSelectedCustomer(null);
    setShowSuggestions(false);

    setError(null);
  }

  function handleClose() {
    if (saving) return;

    resetForm();
    onClose();
  }

  // ============================================================
  // SEARCH EXISTING CUSTOMERS
  // ============================================================

  useEffect(() => {
    if (!open) {
      return;
    }

    const query = name.trim();

    // Don't search for very short names.
    if (query.length < 2) {
      setMatches([]);
      setShowSuggestions(false);
      setSearchingCustomers(false);
      return;
    }

    // If an existing customer has already been selected,
    // don't keep showing the search suggestions.
    if (selectedCustomer) {
      return;
    }

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(async () => {
      try {
        setSearchingCustomers(true);

        const response = await fetch(
          `${API_URL}/customers/search?q=${encodeURIComponent(query)}`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            `Customer search returned ${response.status}`
          );
        }

        const data = await response.json();

        const customerMatches: CustomerMatch[] =
          Array.isArray(data?.matches)
            ? data.matches
            : [];

        setMatches(customerMatches);
        setShowSuggestions(customerMatches.length > 0);
      } catch (err) {
        console.error(
          "Failed to search existing customers:",
          err
        );

        setMatches([]);
        setShowSuggestions(false);
      } finally {
        setSearchingCustomers(false);
      }
    }, 300);

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [name, open, selectedCustomer]);

  // ============================================================
  // SELECT EXISTING CUSTOMER
  // ============================================================

  function handleSelectCustomer(customer: CustomerMatch) {
    setSelectedCustomer(customer);

    // Keep the existing Odoo customer data.
    // We only use it to pre-fill the lead form.
    setName(customer.name);

    if (customer.phone) {
      setPhone(customer.phone);
    }

    if (customer.email) {
      setEmail(customer.email);
    }

    setMatches([]);
    setShowSuggestions(false);
    setError(null);
  }

  // ============================================================
  // CREATE LEAD
  // ============================================================

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Lead name is required.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`${API_URL}/crm/leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          description: description.trim() || null,

          // IMPORTANT:
          // If an existing Odoo customer was selected,
          // create a NEW CRM lead linked to that customer.
          //
          // We do NOT create another res.partner.
          partner_id: selectedCustomer?.id ?? null,
        }),
      });

      if (!response.ok) {
        let message = `Lead API returned ${response.status}`;

        try {
          const data = await response.json();

          if (typeof data?.detail === "string") {
            message = data.detail;
          }
        } catch {
          // Keep the HTTP status message.
        }

        throw new Error(message);
      }

      resetForm();
      onClose();
      onCreated?.();
    } catch (err) {
      console.error("Failed to create lead:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create lead."
      );
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // DON'T RENDER
  // ============================================================

  if (!open) {
    return null;
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#2B2B30] bg-[#111113] shadow-[0_30px_100px_rgba(0,0,0,.55)]">

        {/* ======================================================
            HEADER
        ====================================================== */}

        <div className="flex items-center justify-between border-b border-[#2B2B30] px-5 py-4">
          <div>
            <div className="flex items-center gap-2">

              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C8F065]/10 text-[#C8F065]">
                <UserRound size={16} />
              </div>

              <div>
                <h2 className="font-[Syne] text-sm font-semibold text-white">
                  Add Lead
                </h2>

                <p className="mt-0.5 text-[10px] text-[#71717A]">
                  Create a new CRM lead in Odoo
                </p>
              </div>

            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#71717A] transition hover:bg-[#17171A] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        {/* ======================================================
            FORM
        ====================================================== */}

        <form onSubmit={handleSubmit}>

          <div className="space-y-4 p-5">

            {/* ==================================================
                LEAD NAME / CUSTOMER SEARCH
            ================================================== */}

            <div className="relative">

              <label className="mb-1.5 block text-[11px] font-medium text-[#A1A1AA]">
                Lead name
              </label>

              <div className="relative">

                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525B]"
                />

                <input
                  autoFocus
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);

                    // If the user changes the name after selecting
                    // a customer, remove the selected customer.
                    if (
                      selectedCustomer &&
                      normalizeName(event.target.value) !==
                        normalizeName(selectedCustomer.name)
                    ) {
                      setSelectedCustomer(null);
                    }

                    setError(null);
                  }}
                  onFocus={() => {
                    if (
                      matches.length > 0 &&
                      !selectedCustomer
                    ) {
                      setShowSuggestions(true);
                    }
                  }}
                  placeholder="e.g. Ahmed Ben Ali"
                  className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#09090B] pl-9 pr-10 text-sm text-white outline-none placeholder:text-[#52525B] transition focus:border-[#C8F065]/50"
                />

                {searchingCustomers && (
                  <Loader2
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#71717A]"
                  />
                )}

              </div>

              {/* =================================================
                  EXISTING CUSTOMER SUGGESTIONS
              ================================================= */}

              {showSuggestions &&
                !selectedCustomer &&
                matches.length > 0 && (
                  <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-xl border border-[#2B2B30] bg-[#111113] shadow-[0_20px_50px_rgba(0,0,0,.45)]">

                    <div className="border-b border-[#2B2B30] px-3 py-2">
                      <div className="text-[10px] font-medium uppercase tracking-wider text-[#71717A]">
                        Existing contacts
                      </div>

                      <div className="mt-0.5 text-[10px] text-[#52525B]">
                        Select a contact to link this new lead to them
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto">

                      {matches.map((customer) => {

                        const exactNameMatch =
                          normalizeName(customer.name) ===
                          normalizeName(name);

                        return (
                          <button
                            key={customer.id}
                            type="button"
                            onMouseDown={(event) => {
                              event.preventDefault();
                            }}
                            onClick={() =>
                              handleSelectCustomer(customer)
                            }
                            className="w-full border-b border-[#2B2B30] px-3 py-3 text-left transition last:border-0 hover:bg-[#17171A]"
                          >

                            <div className="flex items-start gap-3">

                              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#C8F065]/10 text-[#C8F065]">
                                <UserRound size={14} />
                              </div>

                              <div className="min-w-0 flex-1">

                                <div className="flex items-center gap-2">

                                  <span className="truncate text-sm font-medium text-white">
                                    {customer.name}
                                  </span>

                                  {exactNameMatch && (
                                    <span className="shrink-0 rounded-md bg-[#F06AAA]/10 px-1.5 py-0.5 text-[9px] font-medium text-[#F06AAA]">
                                      Possible duplicate
                                    </span>
                                  )}

                                </div>

                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#71717A]">

                                  {customer.phone && (
                                    <span>
                                      {customer.phone}
                                    </span>
                                  )}

                                  {customer.email && (
                                    <span className="truncate">
                                      {customer.email}
                                    </span>
                                  )}

                                </div>

                                <div className="mt-1.5">

                                  {customer.is_customer ? (
                                    <span className="text-[9px] text-[#C8F065]">
                                      Existing CRM customer
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-[#71717A]">
                                      Existing Odoo contact
                                    </span>
                                  )}

                                </div>

                              </div>

                            </div>

                          </button>
                        );
                      })}

                    </div>

                    <div className="border-t border-[#2B2B30] bg-[#09090B] px-3 py-2">
                      <div className="text-[9px] text-[#52525B]">
                        Selecting a contact creates a new lead linked
                        to the existing customer. Their customer record
                        will not be duplicated.
                      </div>
                    </div>

                  </div>
                )}

              {/* =================================================
                  SELECTED CUSTOMER
              ================================================= */}

              {selectedCustomer && (
                <div className="mt-2 rounded-xl border border-[#C8F065]/20 bg-[#C8F065]/5 p-3">

                  <div className="flex items-start gap-3">

                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#C8F065]/10 text-[#C8F065]">
                      <Check size={15} />
                    </div>

                    <div className="min-w-0 flex-1">

                      <div className="text-[9px] font-medium uppercase tracking-wider text-[#C8F065]">
                        Linked to existing customer
                      </div>

                      <div className="mt-1 truncate text-sm font-medium text-white">
                        {selectedCustomer.name}
                      </div>

                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#71717A]">

                        {selectedCustomer.phone && (
                          <span>
                            {selectedCustomer.phone}
                          </span>
                        )}

                        {selectedCustomer.email && (
                          <span className="truncate">
                            {selectedCustomer.email}
                          </span>
                        )}

                      </div>

                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setName("");
                        setPhone("");
                        setEmail("");
                      }}
                      disabled={saving}
                      className="shrink-0 text-[10px] text-[#71717A] transition hover:text-white"
                    >
                      Change
                    </button>

                  </div>

                </div>
              )}

            </div>

            {/* ==================================================
                PHONE + EMAIL
            ================================================== */}

            <div className="grid gap-4 sm:grid-cols-2">

              <div>

                <label className="mb-1.5 block text-[11px] font-medium text-[#A1A1AA]">
                  Phone
                </label>

                <div className="relative">

                  <Phone
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525B]"
                  />

                  <input
                    value={phone}
                    onChange={(event) =>
                      setPhone(event.target.value)
                    }
                    placeholder="+216 ..."
                    className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#09090B] pl-9 pr-3 text-sm text-white outline-none placeholder:text-[#52525B] transition focus:border-[#C8F065]/50"
                  />

                </div>

              </div>

              <div>

                <label className="mb-1.5 block text-[11px] font-medium text-[#A1A1AA]">
                  Email
                </label>

                <div className="relative">

                  <Mail
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525B]"
                  />

                  <input
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    placeholder="client@email.com"
                    className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#09090B] pl-9 pr-3 text-sm text-white outline-none placeholder:text-[#52525B] transition focus:border-[#C8F065]/50"
                  />

                </div>

              </div>

            </div>

            {/* ==================================================
                NOTES
            ================================================== */}

            <div>

              <label className="mb-1.5 block text-[11px] font-medium text-[#A1A1AA]">
                Notes
              </label>

              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder="Rental requirements, source, follow-up notes..."
                rows={4}
                className="w-full resize-none rounded-lg border border-[#2B2B30] bg-[#09090B] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#52525B] transition focus:border-[#C8F065]/50"
              />

            </div>

            {/* ==================================================
                ERROR
            ================================================== */}

            {error && (
              <div className="rounded-lg border border-[#F06AAA]/30 bg-[#F06AAA]/5 px-3 py-2.5 text-xs text-[#F06AAA]">
                {error}
              </div>
            )}

          </div>

          {/* ====================================================
              FOOTER
          ==================================================== */}

          <div className="flex items-center justify-end gap-2 border-t border-[#2B2B30] px-5 py-4">

            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="h-9 rounded-lg border border-[#2B2B30] bg-[#17171A] px-4 text-xs font-medium text-[#A1A1AA] transition hover:text-white disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex h-9 items-center gap-2 rounded-lg bg-[#C8F065] px-4 text-xs font-semibold text-[#09090B] transition hover:bg-[#d7ff80] disabled:cursor-not-allowed disabled:opacity-60"
            >

              {saving ? (
                <Loader2
                  size={14}
                  className="animate-spin"
                />
              ) : (
                <Plus size={14} />
              )}

              {saving
                ? "Creating..."
                : "Create Lead"}

            </button>

          </div>

        </form>

      </div>
    </div>
  );
}
