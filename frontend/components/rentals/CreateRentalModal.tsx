"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
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

type Vehicle = {
  id: number;
  name: string;
  license_plate: string | null;
  status: string | null;
};

type Product = {
  id: number;
  name: string;
  list_price: number;
  suggested_product_ids: number[];
};

type RentalOptionsResponse = {
  customers: Customer[];
  vehicles: Vehicle[];
  products: Product[];
};

type SelectedProduct = {
  product_id: number;
  quantity: number;
  unit_price?: number;
};

type CreateRentalModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (sale: unknown) => void;

  // Optional CRM opportunity.
  opportunityId?: number | null;

  // Optional pre-selected customer.
  customerId?: number | null;

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

  const [productSearch, setProductSearch] =
    useState("");

  const [selectedProducts, setSelectedProducts] =
    useState<SelectedProduct[]>([]);

  const [form, setForm] = useState({
    partner_id: customerId
      ? String(customerId)
      : "",

    vehicle_id: "",

    start_date: startDate,

    end_date: endDate,
  });

  // ==========================================================
  // LOAD OPTIONS
  // ==========================================================

  useEffect(() => {
    if (!open) return;

    async function loadOptions() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `${API_URL}/rentals/options`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            `Rental options API returned ${response.status}`
          );
        }

        const data: RentalOptionsResponse =
          await response.json();

        setOptions(data);

        // Preserve customer passed by CRM.
        if (customerId) {
          setForm((current) => ({
            ...current,
            partner_id: String(customerId),
          }));
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
  }, [open, customerId]);

  // ==========================================================
  // RESET WHEN CLOSED
  // ==========================================================

  useEffect(() => {
    if (open) return;

    setCustomerSearch("");
    setProductSearch("");
    setSelectedProducts([]);

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
  // FILTER CUSTOMERS
  // ==========================================================

  const filteredCustomers =
    useMemo(() => {
      if (!options) return [];

      const query =
        customerSearch
          .toLowerCase()
          .trim();

      if (!query) {
        return options.customers;
      }

      return options.customers.filter(
        (customer) =>
          customer.name
            .toLowerCase()
            .includes(query)
      );
    }, [
      options,
      customerSearch,
    ]);

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
          )
      );
    }, [
      options,
      selectedProducts,
      selectedProductIds,
    ]);

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
            quantity: 1,
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
    if (quantity <= 0) {
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
                quantity,
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
  // CREATE RENTAL
  // ==========================================================

  async function createRental(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError(null);

    if (
      selectedProducts.length ===
      0
    ) {
      setError(
        "Add at least one product to the rental."
      );
      return;
    }

    if (
      form.end_date <
      form.start_date
    ) {
      setError(
        "The return date must be on or after the rental start date."
      );
      return;
    }

    try {
      setSubmitting(true);

      const response =
        await fetch(
          `${API_URL}/rentals`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              partner_id:
                Number(
                  form.partner_id
                ),

              vehicle_id:
                Number(
                  form.vehicle_id
                ),

              start_date:
                form.start_date,

              end_date:
                form.end_date,

              products:
                selectedProducts,

              ...(opportunityId
                ? {
                    opportunity_id:
                      opportunityId,
                  }
                : {}),
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to create rental."
        );
      }

      onCreated?.(
        data.sale
      );

      onClose();
    } catch (err) {
      console.error(
        "Failed to create rental:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create rental."
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
              Rental
            </div>

            <h2
              id="new-rental-title"
              className="mt-1 text-xl font-semibold text-white"
            >
              New rental
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Build a rental with a vehicle and multiple products.
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
            onSubmit={createRental}
            className="p-5 sm:p-6"
          >

            {/* ==================================================
                CUSTOMER + VEHICLE
            ================================================== */}

            <div className="grid gap-4 sm:grid-cols-2">

              {/* CUSTOMER */}

              <div className="space-y-2">

                <label className="text-xs font-medium text-zinc-400">
                  Customer
                </label>

                <div className="relative">

                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                  />

                  <input
                    value={
                      customerSearch
                    }
                    onChange={(event) =>
                      setCustomerSearch(
                        event.target.value
                      )
                    }
                    placeholder="Search customers..."
                    className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#17171A] pl-9 pr-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#C8F065]/50"
                  />

                </div>

                <select
                  required
                  value={
                    form.partner_id
                  }
                  onChange={(event) =>
                    setForm({
                      ...form,
                      partner_id:
                        event.target.value,
                    })
                  }
                  className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#17171A] px-3 text-sm text-white outline-none focus:border-[#C8F065]/50"
                >

                  <option value="">
                    Select customer
                  </option>

                  {filteredCustomers.map(
                    (customer) => (
                      <option
                        key={
                          customer.id
                        }
                        value={
                          customer.id
                        }
                      >
                        {customer.name}
                      </option>
                    )
                  )}

                </select>

              </div>

              {/* VEHICLE */}

              <label className="space-y-2 text-xs font-medium text-zinc-400">

                Fleet vehicle

                <select
                  required
                  value={
                    form.vehicle_id
                  }
                  onChange={(event) =>
                    setForm({
                      ...form,
                      vehicle_id:
                        event.target.value,
                    })
                  }
                  className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#17171A] px-3 text-sm text-white outline-none focus:border-[#C8F065]/50"
                >

                  <option value="">
                    Select vehicle
                  </option>

                  {options.vehicles.map(
                    (vehicle) => (
                      <option
                        key={
                          vehicle.id
                        }
                        value={
                          vehicle.id
                        }
                      >
                        {vehicle.name}

                        {vehicle.license_plate
                          ? ` — ${vehicle.license_plate}`
                          : ""}

                        {vehicle.status
                          ? ` (${vehicle.status})`
                          : ""}
                      </option>
                    )
                  )}

                </select>

              </label>

            </div>

            {/* ==================================================
                DATES
            ================================================== */}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">

              <label className="space-y-2 text-xs font-medium text-zinc-400">

                Rental start

                <input
                  required
                  type="date"
                  value={
                    form.start_date
                  }
                  onChange={(event) =>
                    setForm({
                      ...form,
                      start_date:
                        event.target.value,
                    })
                  }
                  className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#17171A] px-3 text-sm text-white outline-none focus:border-[#C8F065]/50"
                />

              </label>

              <label className="space-y-2 text-xs font-medium text-zinc-400">

                Return date

                <input
                  required
                  type="date"
                  value={
                    form.end_date
                  }
                  onChange={(event) =>
                    setForm({
                      ...form,
                      end_date:
                        event.target.value,
                    })
                  }
                  className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#17171A] px-3 text-sm text-white outline-none focus:border-[#C8F065]/50"
                />

              </label>

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
                            min="0.01"
                            step="0.01"
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
                {selectedProducts.length ===
                1
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
                  disabled={
                    submitting ||
                    selectedProducts.length ===
                      0
                  }
                  className="flex h-9 items-center gap-2 rounded-lg bg-[#C8F065] px-4 text-xs font-semibold text-black transition hover:bg-[#d7ff80] disabled:cursor-not-allowed disabled:opacity-50"
                >

                  {submitting && (
                    <LoaderCircle
                      size={
                        14
                      }
                      className="animate-spin"
                    />
                  )}

                  Create rental

                </button>

              </div>

            </div>

          </form>
        )}

      </div>

    </div>
  );
}
