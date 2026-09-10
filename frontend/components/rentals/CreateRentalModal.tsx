"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {

    Check,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
  X,

} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.rental-os.klynx.net";

// ============================================================
// TYPES
// ============================================================

type Customer = {
  id: number;
  name: string;
};

type CustomerMatch = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  is_customer: boolean;
};

type Vehicle = {
  id: number;
  name: string;
  license_plate: string | null;
  status: string | null;
  category: { id: number; name: string } | null;
  brand: { id: number; name: string } | null;
  available: boolean;
};

type VehicleOption = {
  id: number;
  name: string;
};

type LeadOptions = {
  vehicle_types: VehicleOption[];
  vehicle_brands: VehicleOption[];
};

type Product = {
  id: number;
  name: string;
  list_price: number;
  reference: string | null;
  is_deposit: boolean;
  suggested_product_ids: number[];
};

type RentalOptionsResponse = {
  customers: Customer[];
  vehicles: Vehicle[];
  products: Product[];
};

// Minimal shape of what the backend returns for a created sale —
// only the fields this component actually reads (used for
// onCreated and the lead-handoff), not a full mirror of the API.
type CreatedSale = {
  id?: number;
  customer?: {
    id: number;
    name: string;
  };
  [key: string]: unknown;
};

type SelectedProduct = {
  product_id: number;
  quantity: number;
  unit_price?: number;
};

type CreateRentalModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (result: unknown) => void;

  // Optional CRM opportunity.
  opportunityId?: number | null;

  // Optional pre-selected customer.
  customerId?: number | null;
  // Seeds the customer search field when there's no customerId
  // yet (e.g. handed off from a lead that had a typed name but
  // no linked existing contact) — saves retyping.
  initialCustomerName?: string;

  // Optional pre-filled dates.
  startDate?: string;
  endDate?: string;
};

// ============================================================
// COMPONENT
// ============================================================

export default function CreateRentalModal({
  open,
  onClose,
  onCreated,
  opportunityId = null,
  customerId = null,
  initialCustomerName = "",
  startDate = "",
  endDate = "",
}: CreateRentalModalProps) {
  const [options, setOptions] =
    useState<RentalOptionsResponse | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [customerSearch, setCustomerSearch] =
    useState("");

  const [selectedCustomerName, setSelectedCustomerName] =
    useState<string | null>(null);

  const [customerDropdownOpen, setCustomerDropdownOpen] =
    useState(false);

  // Live customer search — same debounced match-list pattern
  // used throughout the app.
  const [customerMatches, setCustomerMatches] = useState<
    CustomerMatch[]
  >([]);

  const [searchingCustomers, setSearchingCustomers] =
    useState(false);

  const [showCreateCustomer, setShowCreateCustomer] =
    useState(false);

  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [createCustomerError, setCreateCustomerError] = useState<
    string | null
  >(null);

  const customerSearchTimeout = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const [productSearch, setProductSearch] =
    useState("");

  const [selectedProducts, setSelectedProducts] =
    useState<SelectedProduct[]>([]);

  // Vehicle preference — reuses the same /crm/lead-options
  // endpoint used by the lead fallback below, since it's the
  // same category/brand data, just used here to filter the
  // vehicle picker instead of tagging a lead description.
  const [leadOptions, setLeadOptions] =
    useState<LeadOptions | null>(null);

  const [vehicleTypeId, setVehicleTypeId] =
    useState<number | null>(null);

  const [vehicleBrandId, setVehicleBrandId] =
    useState<number | null>(null);

  const [showAllVehicles, setShowAllVehicles] =
    useState(false);

  const [form, setForm] = useState({
    partner_id: customerId
      ? String(customerId)
      : "",

    vehicle_id: "",

    start_date: startDate,

    end_date: endDate,
  });

  // ==========================================================
  // RENTAL DAYS
  //
  // Basis for daily product quantities below. Inclusive of
  // both endpoints (08/07 -> 10/07 = 3 days), minimum 1 so an
  // incomplete/same-day range never zeroes out a quantity.
  // ==========================================================

  const rentalDays = useMemo(() => {
    if (!form.start_date || !form.end_date) return 1;

    const start = new Date(form.start_date);
    const end = new Date(form.end_date);

    const days =
      Math.round(
        (end.getTime() - start.getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1;

    return days > 0 ? days : 1;
  }, [form.start_date, form.end_date]);

  // ==========================================================
  // LOAD OPTIONS
  // ==========================================================

  useEffect(() => {
    if (!open) return;

    async function loadOptions() {
      try {
        setLoading(true);
        setError(null);

        const [rentalOptionsResponse, leadOptionsResponse] =
          await Promise.all([
            fetch(`${API_URL}/rentals/options`, {
              cache: "no-store",
            }),
            fetch(`${API_URL}/crm/lead-options`, {
              cache: "no-store",
            }),
          ]);

        if (!rentalOptionsResponse.ok) {
          throw new Error(
            `Rental options API returned ${rentalOptionsResponse.status}`
          );
        }

        const data: RentalOptionsResponse =
          await rentalOptionsResponse.json();

        setOptions(data);

        // Vehicle preference lists are non-critical — don't
        // block the whole form over them if this one call fails.
        if (leadOptionsResponse.ok) {
          setLeadOptions(await leadOptionsResponse.json());
        }

        // Preserve customer passed by CRM.
        if (customerId) {
          setForm((current) => ({
            ...current,
            partner_id: String(customerId),
          }));

          const preselected = data.customers.find(
            (customer) => customer.id === customerId
          );

          if (preselected) {
            setSelectedCustomerName(preselected.name);
          }
        } else if (initialCustomerName) {
          setCustomerSearch(initialCustomerName);
        }
      } catch (err) {
        console.error(
          "Failed to load rental options:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load rental choices."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadOptions();
  }, [open, customerId, initialCustomerName]);

  // ==========================================================
  // REFRESH VEHICLE AVAILABILITY WHEN DATES CHANGE
  // ==========================================================

  useEffect(() => {
    if (!open || !form.start_date || !form.end_date) {
      return;
    }

    async function refreshVehicles() {
      try {
        const response = await fetch(
          `${API_URL}/rentals/options?start_date=${form.start_date}&end_date=${form.end_date}`,
          { cache: "no-store" }
        );

        if (!response.ok) return;

        const data: RentalOptionsResponse = await response.json();

        setOptions((current) =>
          current ? { ...current, vehicles: data.vehicles } : data
        );
      } catch (err) {
        console.error(
          "Failed to refresh vehicle availability:",
          err
        );
      }
    }

    void refreshVehicles();
  }, [open, form.start_date, form.end_date]);

  // ==========================================================
  // RESET WHEN CLOSED
  // ==========================================================

  useEffect(() => {
    if (open) return;

    setCustomerSearch("");
    setSelectedCustomerName(null);
    setCustomerDropdownOpen(false);
    setCustomerMatches([]);
    setShowCreateCustomer(false);
    setNewCustomerPhone("");
    setNewCustomerEmail("");
    setCreateCustomerError(null);
    setProductSearch("");
    setSelectedProducts([]);
    setVehicleTypeId(null);
    setVehicleBrandId(null);
    setShowAllVehicles(false);

    setForm({
      partner_id: customerId
        ? String(customerId)
        : "",

      vehicle_id: "",

      start_date: startDate,

      end_date: endDate,
    });

    setError(null);
  }, [
    open,
    customerId,
    startDate,
    endDate,
  ]);

  // ==========================================================
  // SELECTED PRODUCT HELPERS
  // ==========================================================

  const selectedProductIds = useMemo(
    () =>
      new Set(
        selectedProducts.map(
          (product) =>
            product.product_id
        )
      ),
    [selectedProducts]
  );

  const selectedProductObjects =
    useMemo(() => {
      if (!options) return [];

      return selectedProducts
        .map((selected) => {
          const product =
            options.products.find(
              (item) =>
                item.id ===
                selected.product_id
            );

          if (!product) return null;

          return {
            ...selected,
            product,
          };
        })
        .filter(
          (
            item
          ): item is {
            product_id: number;
            quantity: number;
            unit_price?: number;
            product: Product;
          } => Boolean(item)
        );
    }, [
      options,
      selectedProducts,
    ]);

  // ==========================================================
  // LIVE CUSTOMER SEARCH EFFECT
  // ==========================================================

  useEffect(() => {
    if (!open || form.partner_id) {
      return;
    }

    const query = customerSearch.trim();

    if (query.length < 2) {
      setCustomerMatches([]);
      return;
    }

    if (customerSearchTimeout.current) {
      clearTimeout(customerSearchTimeout.current);
    }

    customerSearchTimeout.current = setTimeout(async () => {
      try {
        setSearchingCustomers(true);

        const response = await fetch(
          `${API_URL}/customers/search?q=${encodeURIComponent(
            query
          )}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error(
            `Customer search returned ${response.status}`
          );
        }

        const data = await response.json();

        setCustomerMatches(
          Array.isArray(data?.matches) ? data.matches : []
        );
      } catch (err) {
        console.error("Failed to search customers:", err);
        setCustomerMatches([]);
      } finally {
        setSearchingCustomers(false);
      }
    }, 300);

    return () => {
      if (customerSearchTimeout.current) {
        clearTimeout(customerSearchTimeout.current);
      }
    };
  }, [customerSearch, open, form.partner_id]);

  async function handleCreateCustomer() {
    const trimmedName = customerSearch.trim();

    if (!trimmedName) {
      setCreateCustomerError("Name is required.");
      return;
    }

    try {
      setCreatingCustomer(true);
      setCreateCustomerError(null);

      const response = await fetch(`${API_URL}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          phone: newCustomerPhone.trim() || null,
          email: newCustomerEmail.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();

      setForm((current) => ({
        ...current,
        partner_id: String(data.partner_id),
      }));

      setSelectedCustomerName(trimmedName);
      setShowCreateCustomer(false);
      setCustomerDropdownOpen(false);
      setNewCustomerPhone("");
      setNewCustomerEmail("");
    } catch (err) {
      console.error("Failed to create customer:", err);
      setCreateCustomerError(
        "Unable to create customer. Please try again."
      );
    } finally {
      setCreatingCustomer(false);
    }
  }

  // ==========================================================
  // FILTER VEHICLES
  //
  // Default view: only vehicles that are actually available
  // (fleet status + no conflicting booking for the chosen
  // dates) and matching the selected type/brand preference.
  // "Show all vehicles" is an explicit escape hatch for the
  // rare case an agent wants to browse the full fleet anyway.
  // ==========================================================

  const filteredVehicles = useMemo(() => {
    if (!options) return [];

    return options.vehicles.filter((vehicle) => {
      if (!showAllVehicles && !vehicle.available) {
        return false;
      }

      if (
        vehicleTypeId &&
        vehicle.category?.id !== vehicleTypeId
      ) {
        return false;
      }

      if (
        vehicleBrandId &&
        vehicle.brand?.id !== vehicleBrandId
      ) {
        return false;
      }

      return true;
    });
  }, [options, showAllVehicles, vehicleTypeId, vehicleBrandId]);

  const hiddenVehicleCount = options
    ? options.vehicles.length - filteredVehicles.length
    : 0;

  // ==========================================================
  // FILTER PRODUCTS
  // ==========================================================

  const filteredProducts =
    useMemo(() => {
      if (!options) return [];

      const query =
        productSearch
          .toLowerCase()
          .trim();

      if (!query) {
        return options.products;
      }

      return options.products.filter(
        (product) =>
          product.name
            .toLowerCase()
            .includes(query)
      );
    }, [
      options,
      productSearch,
    ]);

  // ==========================================================
  // VEHICLE-TYPE PRODUCT SUGGESTIONS
  //
  // Separate from the addon suggestions above (which come from
  // Odoo's own optional_product_ids and stay untouched). This
  // matches the selected vehicle type/category against product
  // references — e.g. "Economy" -> a 3-letter code "ECO" -> any
  // product whose reference contains it (LOC-ECO, DEP-ECO).
  // Falls back to the picked vehicle's own category if no type
  // preference was set. Reference-based, not product names, per
  // spec — this only works if Odoo's product references actually
  // follow a matching convention; if they don't, nothing matches
  // and the addon suggestions below still work independently.
  // ==========================================================

  const vehicleTypeProducts = useMemo(() => {
    if (!options) return [];

    const typeName = vehicleTypeId
      ? leadOptions?.vehicle_types.find(
          (type) => type.id === vehicleTypeId
        )?.name
      : options.vehicles.find(
          (vehicle) => String(vehicle.id) === form.vehicle_id
        )?.category?.name;

    if (!typeName) return [];

    const code = typeName
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .slice(0, 3);

    if (!code) return [];

    return options.products.filter(
      (product) =>
        !selectedProductIds.has(product.id) &&
        (product.reference || "")
          .toUpperCase()
          .includes(code)
    );
  }, [
    options,
    leadOptions,
    vehicleTypeId,
    form.vehicle_id,
    selectedProductIds,
  ]);

  // ==========================================================
  // SUGGESTIONS
  // ==========================================================

  const suggestedProducts =
    useMemo(() => {
      if (!options) return [];

      const suggestedIds =
        new Set<number>();

      for (
        const selected of selectedProducts
      ) {
        const product =
          options.products.find(
            (item) =>
              item.id ===
              selected.product_id
          );

        if (!product) continue;

        for (
          const suggestedId
          of product.suggested_product_ids
        ) {
          if (
            !selectedProductIds.has(
              suggestedId
            )
          ) {
            suggestedIds.add(
              suggestedId
            );
          }
        }
      }

      return options.products.filter(
        (product) =>
          suggestedIds.has(
            product.id
          ) &&
          !vehicleTypeProducts.some(
            (typeProduct) => typeProduct.id === product.id
          )
      );
    }, [
      options,
      selectedProducts,
      selectedProductIds,
      vehicleTypeProducts,
    ]);

  // ==========================================================
  // KEEP DAILY QUANTITIES IN SYNC WITH RENTAL LENGTH
  //
  // If dates change after a product was already added, its
  // quantity should follow — the agent shouldn't have to
  // manually redo the math. Deposits are untouched (always 1).
  // ==========================================================

  useEffect(() => {
    if (!options) return;

    setSelectedProducts((current) =>
      current.map((item) => {
        const product = options.products.find(
          (candidate) => candidate.id === item.product_id
        );

        if (!product || product.is_deposit) return item;

        return { ...item, quantity: rentalDays };
      })
    );
    // Only rentalDays should trigger this — options/current are
    // read, not reacted to, to avoid recomputing on every
    // unrelated product-list refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rentalDays]);

  // ==========================================================
  // ADD PRODUCT
  // ==========================================================

  function addProduct(
    product: Product
  ) {
    setSelectedProducts(
      (current) => {
        const existing =
          current.find(
            (item) =>
              item.product_id ===
              product.id
          );

        if (existing) {
          return current.map(
            (item) =>
              item.product_id ===
              product.id
                ? {
                    ...item,
                    quantity:
                      item.quantity + 1,
                  }
                : item
          );
        }

        return [
          ...current,
          {
            product_id:
              product.id,
            quantity: product.is_deposit
              ? 1
              : rentalDays,
          },
        ];
      }
    );
  }

  // ==========================================================
  // REMOVE PRODUCT
  // ==========================================================

  function removeProduct(
    productId: number
  ) {
    setSelectedProducts(
      (current) =>
        current.filter(
          (product) =>
            product.product_id !==
            productId
        )
    );
  }

  // ==========================================================
  // CHANGE QUANTITY
  // ==========================================================

  function updateQuantity(
    productId: number,
    quantity: number
  ) {
    const wholeQuantity = Math.round(quantity);

    if (wholeQuantity <= 0) {
      removeProduct(productId);
      return;
    }

    setSelectedProducts(
      (current) =>
        current.map((product) =>
          product.product_id ===
          productId
            ? {
                ...product,
                quantity: wholeQuantity,
              }
            : product
        )
    );
  }

  // ==========================================================
  // TOTAL
  // ==========================================================

  const estimatedTotal =
    selectedProductObjects.reduce(
      (sum, item) =>
        sum +
        item.product.list_price *
          item.quantity,
      0
    );

  // ==========================================================
  // IS THIS COMPLETE ENOUGH TO BE A RENTAL?
  //
  // Customer + dates + a specific vehicle + at least one
  // priced product — the same fields the backend's /rentals
  // endpoint actually requires. Anything less and this is still
  // just a prospect: saved as a CRM lead instead, carrying over
  // whatever was filled in (dates, vehicle preference) so
  // nothing typed is lost.
  // ==========================================================

  const isRentalReady = Boolean(
    form.partner_id &&
      form.start_date &&
      form.end_date &&
      form.vehicle_id &&
      selectedProducts.length > 0 &&
      form.end_date >= form.start_date
  );

  async function submitRental(): Promise<CreatedSale> {
    const response = await fetch(`${API_URL}/rentals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partner_id: Number(form.partner_id),
        vehicle_id: Number(form.vehicle_id),
        start_date: form.start_date,
        end_date: form.end_date,
        products: selectedProducts,
        ...(opportunityId ? { opportunity_id: opportunityId } : {}),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Unable to create rental.");
    }

    return data.sale;
  }

  async function submitAsLead(): Promise<{ lead_id: number }> {
    const response = await fetch(`${API_URL}/crm/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: selectedCustomerName || customerSearch.trim(),
        partner_id: form.partner_id
          ? Number(form.partner_id)
          : null,
        reservation_start: form.start_date || null,
        reservation_end: form.end_date || null,
        vehicle_type_id: vehicleTypeId,
        vehicle_brand_id: vehicleBrandId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Unable to save.");
    }

    return data;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError(null);

    if (!form.partner_id) {
      setError("Select or create a customer first.");
      return;
    }

    if (
      form.start_date &&
      form.end_date &&
      form.end_date < form.start_date
    ) {
      setError(
        "The return date must be on or after the rental start date."
      );
      return;
    }

    try {
      setSubmitting(true);

      const result = isRentalReady
        ? await submitRental()
        : await submitAsLead();

      onCreated?.(result);
      onClose();
    } catch (err) {
      console.error("Failed to save:", err);

      setError(
        err instanceof Error ? err.message : "Unable to save."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ==========================================================
  // CLOSED
  // ==========================================================

  if (!open) {
    return null;
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-0 sm:items-center sm:justify-center sm:p-6">

      <div
        className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-[#2B2B30] bg-[#111113] shadow-2xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-rental-title"
      >

        {/* ====================================================
            HEADER
        ==================================================== */}

        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#2B2B30] bg-[#111113] p-5 sm:p-6">

          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#C8F065]">
              Booking
            </div>

            <h2
              id="new-rental-title"
              className="mt-1 text-xl font-semibold text-white"
            >
              New booking
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              {isRentalReady
                ? "This will be saved as a confirmed rental."
                : "This will be saved as a prospect until dates, a vehicle and a price are added."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-[#1B1B1E] hover:text-white"
          >
            <X size={18} />
          </button>

        </div>

        {/* ====================================================
            LOADING
        ==================================================== */}

        {loading ? (
          <div className="flex h-72 items-center justify-center gap-2 text-sm text-zinc-500">
            <LoaderCircle
              size={17}
              className="animate-spin"
            />
            Loading Odoo options...
          </div>
        ) : !options ? (
          <div className="p-6">
            {error && (
              <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="p-5 sm:p-6"
          >

            {/* ==================================================
                CUSTOMER
            ================================================== */}

            <div>

              {/* CUSTOMER */}

              <div className="relative space-y-2">
                <label className="text-xs font-medium text-zinc-400">
                  Customer
                  <span className="ml-1 text-[#F06AAA]">*</span>
                </label>

                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                  />

                  <input
                    required={!form.partner_id}
                    value={
                      selectedCustomerName || customerSearch
                    }
                    onChange={(event) => {
                      setSelectedCustomerName(null);
                      setCustomerSearch(event.target.value);
                      setForm({ ...form, partner_id: "" });
                      setCustomerDropdownOpen(true);
                      setShowCreateCustomer(false);
                    }}
                    onFocus={() => setCustomerDropdownOpen(true)}
                    placeholder="Search customers..."
                    className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#17171A] pl-9 pr-9 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#C8F065]/50"
                  />

                  {searchingCustomers && (
                    <LoaderCircle
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-zinc-500"
                    />
                  )}
                </div>

                {customerDropdownOpen &&
                  !form.partner_id &&
                  customerSearch.trim().length >= 2 &&
                  !showCreateCustomer && (
                    <div className="absolute left-0 right-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border border-[#2B2B30] bg-[#17171A] shadow-2xl">
                      {customerMatches.length === 0 &&
                        !searchingCustomers && (
                          <div className="px-3 py-2.5 text-xs text-zinc-500">
                            No matching customers.
                          </div>
                        )}

                      {customerMatches.slice(0, 20).map((customer) => (
                        <button
                          type="button"
                          key={customer.id}
                          onMouseDown={(event) =>
                            event.preventDefault()
                          }
                          onClick={() => {
                            setForm({
                              ...form,
                              partner_id: String(customer.id),
                            });
                            setSelectedCustomerName(customer.name);
                            setCustomerDropdownOpen(false);
                          }}
                          className="flex w-full flex-col items-start gap-0.5 border-b border-[#2B2B30] px-3 py-2.5 text-left transition last:border-0 hover:bg-[#C8F065]/10"
                        >
                          <span className="text-xs font-medium text-white">
                            {customer.name}
                          </span>

                          <span className="flex flex-wrap gap-x-2 text-[10px] text-zinc-500">
                            {customer.phone && (
                              <span>{customer.phone}</span>
                            )}
                            {customer.email && (
                              <span className="truncate">
                                {customer.email}
                              </span>
                            )}
                            <span
                              className={
                                customer.is_customer
                                  ? "text-[#C8F065]"
                                  : "text-zinc-500"
                              }
                            >
                              {customer.is_customer
                                ? "Existing CRM customer"
                                : "Existing Odoo contact"}
                            </span>
                          </span>
                        </button>
                      ))}

                      {!searchingCustomers && (
                        <button
                          type="button"
                          onMouseDown={(event) =>
                            event.preventDefault()
                          }
                          onClick={() =>
                            setShowCreateCustomer(true)
                          }
                          className="flex w-full items-center gap-2 border-t border-[#2B2B30] bg-[#0D0D0F] px-3 py-2.5 text-left text-xs font-medium text-[#C8F065] transition hover:bg-[#C8F065]/10"
                        >
                          <Plus size={13} />
                          Create new customer
                          {customerSearch.trim()
                            ? ` "${customerSearch.trim()}"`
                            : ""}
                        </button>
                      )}
                    </div>
                  )}

                {/* INLINE QUICK-CREATE */}

                {showCreateCustomer && (
                  <div className="absolute left-0 right-0 z-10 mt-1 space-y-2.5 rounded-lg border border-[#C8F065]/25 bg-[#17171A] p-3 shadow-2xl">
                    <div className="text-xs font-medium text-white">
                      New customer: {customerSearch.trim()}
                    </div>

                    <input
                      value={newCustomerPhone}
                      onChange={(event) =>
                        setNewCustomerPhone(event.target.value)
                      }
                      placeholder="Phone (optional)"
                      className="h-9 w-full rounded-lg border border-[#2B2B30] bg-[#0D0D0F] px-3 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-[#C8F065]/50"
                    />

                    <input
                      value={newCustomerEmail}
                      onChange={(event) =>
                        setNewCustomerEmail(event.target.value)
                      }
                      placeholder="Email (optional)"
                      className="h-9 w-full rounded-lg border border-[#2B2B30] bg-[#0D0D0F] px-3 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-[#C8F065]/50"
                    />

                    {createCustomerError && (
                      <div className="text-[10px] text-red-400">
                        {createCustomerError}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={handleCreateCustomer}
                        disabled={creatingCustomer}
                        className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#C8F065] text-[11px] font-semibold text-[#09090B] transition hover:bg-[#d7ff80] disabled:opacity-60"
                      >
                        {creatingCustomer ? (
                          <LoaderCircle
                            size={12}
                            className="animate-spin"
                          />
                        ) : (
                          <Check size={12} />
                        )}
                        Create & select
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowCreateCustomer(false)}
                        className="h-8 rounded-lg border border-[#2B2B30] px-3 text-[11px] text-zinc-400 transition hover:text-white"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                )}

                {/* Keep the field required without a native <select> */}
                <input
                  required
                  value={form.partner_id}
                  onChange={() => {}}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                />
              </div>

            </div>

            {/* ==================================================
                DATES
            ================================================== */}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">

              <label className="space-y-2 text-xs font-medium text-zinc-400">

                Rental start
                <span className="ml-1 text-zinc-600">
                  (required for a rental)
                </span>

                <input
                  type="date"
                  value={form.start_date}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      start_date: event.target.value,
                    })
                  }
                  className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#17171A] px-3 text-sm text-white outline-none focus:border-[#C8F065]/50"
                />

              </label>

              <label className="space-y-2 text-xs font-medium text-zinc-400">

                Return date
                <span className="ml-1 text-zinc-600">
                  (required for a rental)
                </span>

                <input
                  type="date"
                  value={form.end_date}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      end_date: event.target.value,
                    })
                  }
                  className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#17171A] px-3 text-sm text-white outline-none focus:border-[#C8F065]/50"
                />

              </label>

            </div>

            {/* ==================================================
                VEHICLE PREFERENCE
                Optional filters — narrows the picker below to
                the kind of car being asked for.
            ================================================== */}

            {leadOptions && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">

                <label className="space-y-2 text-xs font-medium text-zinc-400">
                  Vehicle type

                  <select
                    value={vehicleTypeId ?? ""}
                    onChange={(event) =>
                      setVehicleTypeId(
                        event.target.value
                          ? Number(event.target.value)
                          : null
                      )
                    }
                    className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#17171A] px-3 text-sm text-white outline-none focus:border-[#C8F065]/50"
                  >
                    <option value="">Any type</option>

                    {leadOptions.vehicle_types.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-xs font-medium text-zinc-400">
                  Brand

                  <select
                    value={vehicleBrandId ?? ""}
                    onChange={(event) =>
                      setVehicleBrandId(
                        event.target.value
                          ? Number(event.target.value)
                          : null
                      )
                    }
                    className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#17171A] px-3 text-sm text-white outline-none focus:border-[#C8F065]/50"
                  >
                    <option value="">Any brand</option>

                    {leadOptions.vehicle_brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                </label>

              </div>
            )}

            {/* ==================================================
                VEHICLE
                Filtered to available, matching vehicles by
                default — unavailable ones (rented, cleaning,
                maintenance, or already booked for these dates)
                don't clutter the list unless explicitly shown.
            ================================================== */}

            <div className="mt-5 space-y-2">

              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-400">
                  Fleet vehicle
                  <span className="ml-1 text-zinc-600">
                    (required for a rental)
                  </span>
                </label>

                {hiddenVehicleCount > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setShowAllVehicles((current) => !current)
                    }
                    className="text-[10px] text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
                  >
                    {showAllVehicles
                      ? "Show only available"
                      : `Show all vehicles (${hiddenVehicleCount} hidden)`}
                  </button>
                )}
              </div>

              <div className="max-h-52 overflow-y-auto rounded-lg border border-[#2B2B30] bg-[#17171A]">
                {filteredVehicles.length === 0 && (
                  <div className="px-3 py-3 text-xs text-zinc-500">
                    {form.start_date && form.end_date
                      ? "No vehicles available for these dates and preferences."
                      : "No matching vehicles."}
                  </div>
                )}

                {filteredVehicles.map((vehicle) => (
                  <button
                    type="button"
                    key={vehicle.id}
                    onClick={() =>
                      setForm({
                        ...form,
                        vehicle_id: String(vehicle.id),
                      })
                    }
                    className={`flex w-full items-center justify-between border-b border-[#2B2B30] px-3 py-2.5 text-left transition last:border-0 hover:bg-[#C8F065]/10 ${
                      String(vehicle.id) === form.vehicle_id
                        ? "bg-[#C8F065]/10"
                        : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-white">
                        {vehicle.name}
                        {vehicle.license_plate
                          ? ` — ${vehicle.license_plate}`
                          : ""}
                      </div>

                      <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] text-zinc-500">
                        {vehicle.category && (
                          <span>{vehicle.category.name}</span>
                        )}
                        {vehicle.brand && (
                          <span>{vehicle.brand.name}</span>
                        )}
                        {!vehicle.available && (
                          <span className="text-red-400">
                            {vehicle.status || "Unavailable"}
                          </span>
                        )}
                      </div>
                    </div>

                    {String(vehicle.id) === form.vehicle_id && (
                      <Check size={14} className="shrink-0 text-[#C8F065]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ==================================================
                PRODUCTS
            ================================================== */}

            <div className="mt-7">

              <div className="flex items-end justify-between gap-4">

                <div>
                  <div className="text-xs font-medium text-zinc-400">
                    Products
                  </div>

                  <p className="mt-1 text-[11px] text-zinc-600">
                    Add the rental product and any extras.
                  </p>
                </div>

                <div className="text-right">

                  <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                    Estimated
                  </div>

                  <div className="mt-0.5 text-sm font-semibold text-white">
                    {estimatedTotal.toLocaleString()}{" "}
                    TND
                  </div>

                </div>

              </div>

              {/* PRODUCT SEARCH */}

              <div className="relative mt-3">

                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                />

                <input
                  value={
                    productSearch
                  }
                  onChange={(event) =>
                    setProductSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search products..."
                  className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#17171A] pl-9 pr-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#C8F065]/50"
                />

              </div>

              {/* PRODUCT LIST */}

              <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-[#2B2B30] bg-[#17171A]">

                {filteredProducts.length ===
                0 ? (
                  <div className="px-4 py-8 text-center text-xs text-zinc-600">
                    No products found.
                  </div>
                ) : (
                  filteredProducts.map(
                    (product) => {
                      const selected =
                        selectedProductIds.has(
                          product.id
                        );

                      return (
                        <button
                          key={
                            product.id
                          }
                          type="button"
                          onClick={() =>
                            addProduct(
                              product
                            )
                          }
                          className="flex w-full items-center justify-between border-b border-[#2B2B30] px-4 py-3 text-left last:border-0 hover:bg-[#1B1B1E]"
                        >

                          <div className="min-w-0">

                            <div className="truncate text-sm text-white">
                              {
                                product.name
                              }
                            </div>

                            <div className="mt-0.5 text-[11px] text-zinc-600">
                              {product.list_price.toLocaleString()}{" "}
                              TND
                            </div>

                          </div>

                          {selected ? (
                            <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-[#C8F065]">
                              <Check
                                size={
                                  13
                                }
                              />
                              Added
                            </span>
                          ) : (
                            <span className="flex shrink-0 items-center gap-1 rounded-md border border-[#2B2B30] px-2 py-1 text-[10px] text-zinc-400">
                              <Plus
                                size={
                                  12
                                }
                              />
                              Add
                            </span>
                          )}

                        </button>
                      );
                    }
                  )
                )}

              </div>

              {/* =================================================
                  VEHICLE-TYPE PRODUCTS
                  Shown before addon suggestions, per the vehicle
                  type/category selected above.
              ================================================= */}

              {vehicleTypeProducts.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#F06AAA]" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#F06AAA]">
                      Matches this vehicle type
                    </span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    {vehicleTypeProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addProduct(product)}
                        className="flex items-center justify-between rounded-xl border border-[#F06AAA]/20 bg-[#F06AAA]/[0.04] px-3 py-3 text-left transition hover:border-[#F06AAA]/40 hover:bg-[#F06AAA]/[0.08]"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium text-white">
                            {product.name}
                          </div>

                          <div className="mt-1 text-[10px] text-zinc-500">
                            {product.list_price.toLocaleString()} TND
                          </div>
                        </div>

                        <Plus
                          size={14}
                          className="shrink-0 text-[#F06AAA]"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* =================================================
                  SUGGESTED PRODUCTS
              ================================================= */}

              {suggestedProducts.length >
                0 && (
                <div className="mt-4">

                  <div className="mb-2 flex items-center gap-2">

                    <span className="h-1.5 w-1.5 rounded-full bg-[#C8F065]" />

                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#C8F065]">
                      Suggested for this rental
                    </span>

                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">

                    {suggestedProducts.map(
                      (product) => (
                        <button
                          key={
                            product.id
                          }
                          type="button"
                          onClick={() =>
                            addProduct(
                              product
                            )
                          }
                          className="flex items-center justify-between rounded-xl border border-[#C8F065]/20 bg-[#C8F065]/[0.04] px-3 py-3 text-left transition hover:border-[#C8F065]/40 hover:bg-[#C8F065]/[0.08]"
                        >

                          <div className="min-w-0">

                            <div className="truncate text-xs font-medium text-white">
                              {
                                product.name
                              }
                            </div>

                            <div className="mt-1 text-[10px] text-zinc-500">
                              {product.list_price.toLocaleString()}{" "}
                              TND
                            </div>

                          </div>

                          <Plus
                            size={
                              14
                            }
                            className="shrink-0 text-[#C8F065]"
                          />

                        </button>
                      )
                    )}

                  </div>

                </div>
              )}

              {/* =================================================
                  SELECTED PRODUCTS
              ================================================= */}

              {selectedProductObjects.length >
                0 && (
                <div className="mt-5">

                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-600">
                    Selected products
                  </div>

                  <div className="overflow-hidden rounded-xl border border-[#2B2B30]">

                    {selectedProductObjects.map(
                      (item) => (
                        <div
                          key={
                            item.product_id
                          }
                          className="flex items-center gap-3 border-b border-[#2B2B30] bg-[#17171A] px-4 py-3 last:border-0"
                        >

                          <div className="min-w-0 flex-1">

                            <div className="truncate text-sm text-white">
                              {
                                item.product
                                  .name
                              }
                            </div>

                            <div className="mt-0.5 text-[10px] text-zinc-600">
                              {item.product.list_price.toLocaleString()}{" "}
                              TND / unit
                            </div>

                          </div>

                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={
                              item.quantity
                            }
                            onChange={(
                              event
                            ) =>
                              updateQuantity(
                                item.product_id,
                                Number(
                                  event
                                    .target
                                    .value
                                )
                              )
                            }
                            className="h-8 w-20 rounded-md border border-[#2B2B30] bg-[#111113] px-2 text-center text-xs text-white outline-none focus:border-[#C8F065]/50"
                          />

                          <div className="w-24 text-right text-xs font-medium text-white">

                            {(
                              item.product
                                .list_price *
                              item.quantity
                            ).toLocaleString()}{" "}
                            TND

                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeProduct(
                                item.product_id
                              )
                            }
                            className="rounded-md p-1.5 text-zinc-600 hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2
                              size={
                                14
                              }
                            />
                          </button>

                        </div>
                      )
                    )}

                  </div>

                </div>
              )}

            </div>

            {/* ==================================================
                ERROR
            ================================================== */}

            {error && (
              <div className="mt-5 rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {/* ==================================================
                FOOTER
            ================================================== */}

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#2B2B30] pt-5">

              <div className="text-[11px] text-zinc-600">
                {selectedProducts.length}{" "}
                {selectedProducts.length === 1
                  ? "product"
                  : "products"}{" "}
                selected
              </div>

              <div className="flex gap-3">

                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 rounded-lg px-4 text-xs font-medium text-zinc-400 transition hover:bg-[#1B1B1E] hover:text-white"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting || !form.partner_id}
                  className="flex h-9 items-center gap-2 rounded-lg bg-[#C8F065] px-4 text-xs font-semibold text-black transition hover:bg-[#d7ff80] disabled:cursor-not-allowed disabled:opacity-50"
                >

                  {submitting && (
                    <LoaderCircle
                      size={14}
                      className="animate-spin"
                    />
                  )}

                  {isRentalReady ? "Confirm rental" : "Save prospect"}

                </button>

              </div>

            </div>

          </form>
        )}

      </div>

    </div>
  );
}
