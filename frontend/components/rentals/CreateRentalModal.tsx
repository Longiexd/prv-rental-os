"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CalendarDays,
  Car,
  Check,
  ChevronDown,
  LoaderCircle,
  Search,
  UserRound,
  X,
} from "lucide-react";

type Customer = {
  id: number;
  name: string;
};

type Opportunity = {
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

type RentalOptions = {
  customers: Customer[];
  vehicles: Vehicle[];
  products: Product[];
};

type CreateRentalResult = {
  sale: {
    id: number;
    name: string;
    customer: Customer | null;
    state: string;
    date_order: string | null;
    commitment_date: string | null;
    amount_total: number;
    invoice_status: string;
    opportunity: Opportunity | null;
    order_line_ids: number[];
    vehicle_id: number;
    vehicle_name: string;
    vehicle_status: string | null;
  };
};

type Props = {
  open: boolean;
  onClose: () => void;

  /**
   * Optional customer to preselect when opened
   * from CRM.
   */
  initialCustomerId?: number | null;

  /**
   * Optional CRM opportunity to preselect.
   */
  initialOpportunityId?: number | null;

  /**
   * Called after Odoo successfully creates
   * the rental.
   */
  onCreated?: (
    result: CreateRentalResult
  ) => void;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.rental-os.klynx.net";


function getVehicleStatusStyle(
  status: string | null
) {
  const normalized =
    (status || "")
      .trim()
      .toLowerCase();

  if (
    normalized.includes("dispon")
    || normalized.includes("available")
  ) {
    return {
      text: "text-[#C8F065]",
      dot: "bg-[#C8F065]",
      bg: "bg-[#C8F065]/10",
      border: "border-[#C8F065]/20",
    };
  }

  if (
    normalized.includes("loué")
    || normalized.includes("loue")
    || normalized.includes("rented")
  ) {
    return {
      text: "text-[#F06AAA]",
      dot: "bg-[#F06AAA]",
      bg: "bg-[#F06AAA]/10",
      border: "border-[#F06AAA]/20",
    };
  }

  if (
    normalized.includes("maintenance")
    || normalized.includes("entretien")
  ) {
    return {
      text: "text-orange-300",
      dot: "bg-orange-400",
      bg: "bg-orange-400/10",
      border: "border-orange-400/20",
    };
  }

  if (
    normalized.includes("nettoyage")
    || normalized.includes("clean")
  ) {
    return {
      text: "text-blue-300",
      dot: "bg-blue-400",
      bg: "bg-blue-400/10",
      border: "border-blue-400/20",
    };
  }

  return {
    text: "text-zinc-400",
    dot: "bg-zinc-500",
    bg: "bg-zinc-500/10",
    border: "border-zinc-500/20",
  };
}


export default function CreateRentalModal({
  open,
  onClose,
  initialCustomerId = null,
  initialOpportunityId = null,
  onCreated,
}: Props) {

  const [
    options,
    setOptions,
  ] = useState<RentalOptions | null>(
    null
  );

  const [
    opportunities,
    setOpportunities,
  ] = useState<Opportunity[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  const [
    customerSearch,
    setCustomerSearch,
  ] = useState("");

  const [
    vehicleSearch,
    setVehicleSearch,
  ] = useState("");

  const [
    productSearch,
    setProductSearch,
  ] = useState("");

  const [
    optionalProductIds,
    setOptionalProductIds,
  ] = useState<number[]>([]);

  const [
    form,
    setForm,
  ] = useState({
    partner_id:
      initialCustomerId
        ? String(initialCustomerId)
        : "",

    opportunity_id:
      initialOpportunityId
        ? String(initialOpportunityId)
        : "",

    vehicle_id: "",

    product_id: "",

    start_date: "",

    end_date: "",

    quantity: "1",

    unit_price: "",
  });


  // =========================================================
  // RESET / LOAD
  // =========================================================

  useEffect(() => {

    if (!open) {
      return;
    }

    setForm({
      partner_id:
        initialCustomerId
          ? String(initialCustomerId)
          : "",

      opportunity_id:
        initialOpportunityId
          ? String(initialOpportunityId)
          : "",

      vehicle_id: "",

      product_id: "",

      start_date: "",

      end_date: "",

      quantity: "1",

      unit_price: "",
    });

    setOptionalProductIds([]);

    setCustomerSearch("");

    setVehicleSearch("");

    setProductSearch("");

    setError(null);

    async function loadOptions() {

      try {

        setLoading(true);

        const response =
          await fetch(
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

        const data =
          await response.json();

        setOptions(data);

      } catch (err) {

        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load rental options."
        );

      } finally {

        setLoading(false);

      }
    }

    void loadOptions();

  }, [
    open,
    initialCustomerId,
    initialOpportunityId,
  ]);


  // =========================================================
  // LOAD CRM OPPORTUNITIES
  // =========================================================

  useEffect(() => {

    if (
      !open ||
      !form.partner_id
    ) {
      setOpportunities([]);
      return;
    }

    async function loadOpportunities() {

      try {

        const response =
          await fetch(
            `${API_URL}/crm/leads`,
            {
              cache: "no-store",
            }
          );

        if (!response.ok) {
          return;
        }

        const data =
          await response.json();

        const leads =
          Array.isArray(data.leads)
            ? data.leads
            : [];

        const customerId =
          Number(form.partner_id);

        const customerOpportunities =
          leads
            .filter(
              (lead: any) =>
                lead.customer?.id ===
                customerId
            )
            .map(
              (lead: any) => ({
                id: lead.id,
                name: lead.name,
              })
            );

        setOpportunities(
          customerOpportunities
        );

      } catch (err) {

        console.error(
          "Unable to load CRM opportunities:",
          err
        );

      }
    }

    void loadOpportunities();

  }, [
    open,
    form.partner_id,
  ]);


  // =========================================================
  // CUSTOMER OPTIONS
  // =========================================================

  const filteredCustomers =
    useMemo(() => {

      if (!options) {
        return [];
      }

      const query =
        customerSearch
          .trim()
          .toLowerCase();

      if (!query) {
        return options.customers.slice(
          0,
          100
        );
      }

      return options.customers
        .filter(
          (customer) =>
            customer.name
              .toLowerCase()
              .includes(query)
        )
        .slice(
          0,
          100
        );

    }, [
      options,
      customerSearch,
    ]);


  // =========================================================
  // VEHICLE OPTIONS
  // =========================================================

  const filteredVehicles =
    useMemo(() => {

      if (!options) {
        return [];
      }

      const query =
        vehicleSearch
          .trim()
          .toLowerCase();

      let vehicles =
        options.vehicles;

      if (query) {
        vehicles =
          vehicles.filter(
            (vehicle) =>
              vehicle.name
                .toLowerCase()
                .includes(query)
              ||
              vehicle.license_plate
                ?.toLowerCase()
                .includes(query)
              ||
              vehicle.status
                ?.toLowerCase()
                .includes(query)
          );
      }

      /*
       * Available vehicles are intentionally
       * placed first.
       *
       * We still display rented / maintenance /
       * nettoyage vehicles so the user can see
       * the complete Odoo fleet.
       */
      return [
        ...vehicles.filter(
          (vehicle) => {
            const status =
              (
                vehicle.status || ""
              ).toLowerCase();

            return (
              status.includes(
                "dispon"
              ) ||
              status.includes(
                "available"
              )
            );
          }
        ),

        ...vehicles.filter(
          (vehicle) => {
            const status =
              (
                vehicle.status || ""
              ).toLowerCase();

            return !(
              status.includes(
                "dispon"
              ) ||
              status.includes(
                "available"
              )
            );
          }
        ),
      ].slice(
        0,
        100
      );

    }, [
      options,
      vehicleSearch,
    ]);


  // =========================================================
  // PRODUCT OPTIONS
  // =========================================================

  const selectedProduct =
    options?.products.find(
      (product) =>
        product.id ===
        Number(
          form.product_id
        )
    );


  const suggestedProducts =
    useMemo(() => {

      if (
        !options ||
        !selectedProduct
      ) {
        return [];
      }

      return options.products.filter(
        (product) =>
          selectedProduct
            .suggested_product_ids
            .includes(
              product.id
            )
      );

    }, [
      options,
      selectedProduct,
    ]);


  const filteredProducts =
    useMemo(() => {

      if (!options) {
        return [];
      }

      const query =
        productSearch
          .trim()
          .toLowerCase();

      if (!query) {
        return options.products.slice(
          0,
          100
        );
      }

      return options.products
        .filter(
          (product) =>
            product.name
              .toLowerCase()
              .includes(query)
        )
        .slice(
          0,
          100
        );

    }, [
      options,
      productSearch,
    ]);


  // =========================================================
  // CREATE
  // =========================================================

  async function createRental(
    event: FormEvent<HTMLFormElement>
  ) {

    event.preventDefault();

    setError(null);

    if (
      !form.partner_id ||
      !form.vehicle_id ||
      !form.product_id ||
      !form.start_date ||
      !form.end_date
    ) {
      setError(
        "Customer, vehicle, product, start date and return date are required."
      );

      return;
    }

    if (
      form.end_date <
      form.start_date
    ) {
      setError(
        "Return date must be on or after the rental start date."
      );

      return;
    }

    try {

      setSubmitting(true);

      const body: Record<
        string,
        unknown
      > = {
        partner_id:
          Number(
            form.partner_id
          ),

        vehicle_id:
          Number(
            form.vehicle_id
          ),

        product_id:
          Number(
            form.product_id
          ),

        start_date:
          form.start_date,

        end_date:
          form.end_date,

        quantity:
          Number(
            form.quantity
          ),

        optional_product_ids:
          optionalProductIds,
      };


      if (
        form.unit_price !== ""
      ) {
        body.unit_price =
          Number(
            form.unit_price
          );
      }


      if (
        form.opportunity_id
      ) {
        body.opportunity_id =
          Number(
            form.opportunity_id
          );
      }


      const response =
        await fetch(
          `${API_URL}/rentals`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                body
              ),
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
        data
      );

      onClose();

    } catch (err) {

      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create rental."
      );

    } finally {

      setSubmitting(false);

    }
  }


  // =========================================================
  // OPTIONAL PRODUCT TOGGLE
  // =========================================================

  function toggleOptionalProduct(
    productId: number
  ) {

    setOptionalProductIds(
      (current) =>
        current.includes(
          productId
        )

          ? current.filter(
              (id) =>
                id !== productId
            )

          : [
              ...current,
              productId,
            ]
    );

  }


  if (!open) {
    return null;
  }


  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div
      className="
        fixed inset-0 z-50
        flex items-end
        bg-black/70
        p-0
        sm:items-center
        sm:justify-center
        sm:p-6
      "
    >

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-rental-title"
        className="
          max-h-[94vh]
          w-full
          max-w-3xl
          overflow-y-auto
          rounded-t-2xl
          border border-[#2B2B30]
          bg-[#111113]
          shadow-2xl
          sm:rounded-2xl
        "
      >

        {/* =================================================
            HEADER
        ================================================= */}

        <div
          className="
            sticky top-0 z-10
            flex items-start
            justify-between
            gap-4
            border-b
            border-[#2B2B30]
            bg-[#111113]
            px-5 py-5
            sm:px-6
          "
        >

          <div>

            <div
              className="
                mb-1
                flex
                items-center
                gap-2
                text-[10px]
                uppercase
                tracking-wider
                text-[#71717A]
              "
            >
              <Car size={12} />
              Rental operation
            </div>

            <h2
              id="create-rental-title"
              className="
                text-lg
                font-semibold
                text-white
              "
            >
              New rental
            </h2>

            <p
              className="
                mt-1
                text-sm
                text-zinc-500
              "
            >
              Customer, vehicle, products and
              rental dates stay connected to Odoo.
            </p>

          </div>


          <button
            type="button"
            onClick={onClose}
            className="
              rounded-lg
              p-2
              text-zinc-500
              transition
              hover:bg-[#1B1B1E]
              hover:text-white
            "
          >
            <X size={18} />
          </button>

        </div>


        {/* =================================================
            LOADING
        ================================================= */}

        {loading ? (

          <div
            className="
              flex
              h-72
              items-center
              justify-center
              gap-2
              text-sm
              text-zinc-500
            "
          >
            <LoaderCircle
              size={18}
              className="animate-spin"
            />

            Loading Odoo data...

          </div>

        ) : (

          <form
            onSubmit={
              createRental
            }
            className="
              space-y-6
              px-5 py-5
              sm:px-6
            "
          >

            {/* =================================================
                CUSTOMER
            ================================================= */}

            <section>

              <div className="mb-3">

                <div
                  className="
                    flex
                    items-center
                    gap-2
                    text-xs
                    font-medium
                    text-white
                  "
                >
                  <UserRound
                    size={14}
                    className="text-[#C8F065]"
                  />

                  Customer

                </div>

                <p
                  className="
                    mt-1
                    text-[11px]
                    text-zinc-600
                  "
                >
                  Existing Odoo customers and CRM
                  contacts.
                </p>

              </div>


              <div
                className="
                  relative
                "
              >

                <Search
                  size={14}
                  className="
                    absolute
                    left-3
                    top-1/2
                    -translate-y-1/2
                    text-zinc-600
                  "
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
                  className="
                    h-10
                    w-full
                    rounded-lg
                    border
                    border-[#2B2B30]
                    bg-[#17171A]
                    pl-9 pr-3
                    text-sm
                    text-white
                    outline-none
                    placeholder:text-zinc-600
                    focus:border-[#C8F065]/50
                  "
                />

              </div>


              <select
                required
                value={
                  form.partner_id
                }
                onChange={(event) =>
                  setForm(
                    (current) => ({
                      ...current,
                      partner_id:
                        event.target
                          .value,
                      opportunity_id:
                        "",
                    })
                  )
                }
                className="
                  mt-2
                  h-10
                  w-full
                  rounded-lg
                  border
                  border-[#2B2B30]
                  bg-[#17171A]
                  px-3
                  text-sm
                  text-white
                  outline-none
                  focus:border-[#C8F065]/50
                "
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

            </section>


            {/* =================================================
                CRM OPPORTUNITY
            ================================================= */}

            {form.partner_id && (

              <section
                className="
                  rounded-xl
                  border
                  border-[#2B2B30]
                  bg-[#17171A]/50
                  p-4
                "
              >

                <div
                  className="
                    mb-2
                    text-xs
                    font-medium
                    text-white
                  "
                >
                  CRM opportunity
                </div>

                <select
                  value={
                    form.opportunity_id
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        opportunity_id:
                          event.target
                            .value,
                      })
                    )
                  }
                  className="
                    h-10
                    w-full
                    rounded-lg
                    border
                    border-[#2B2B30]
                    bg-[#17171A]
                    px-3
                    text-sm
                    text-white
                    outline-none
                    focus:border-[#C8F065]/50
                  "
                >

                  <option value="">
                    No CRM opportunity
                  </option>

                  {opportunities.map(
                    (opportunity) => (
                      <option
                        key={
                          opportunity.id
                        }
                        value={
                          opportunity.id
                        }
                      >
                        {opportunity.name}
                      </option>
                    )
                  )}

                </select>

                {opportunities.length ===
                  0 && (
                  <p
                    className="
                      mt-2
                      text-[10px]
                      text-zinc-600
                    "
                  >
                    No CRM opportunities
                    found for this customer.
                  </p>
                )}

              </section>

            )}


            {/* =================================================
                VEHICLE
            ================================================= */}

            <section>

              <div className="mb-3">

                <div
                  className="
                    flex
                    items-center
                    gap-2
                    text-xs
                    font-medium
                    text-white
                  "
                >
                  <Car
                    size={14}
                    className="text-[#C8F065]"
                  />

                  Fleet vehicle

                </div>

                <p
                  className="
                    mt-1
                    text-[11px]
                    text-zinc-600
                  "
                >
                  Available vehicles are suggested
                  first. All active Odoo fleet
                  vehicles remain visible.
                </p>

              </div>


              <div className="relative">

                <Search
                  size={14}
                  className="
                    absolute
                    left-3
                    top-1/2
                    -translate-y-1/2
                    text-zinc-600
                  "
                />

                <input
                  value={
                    vehicleSearch
                  }
                  onChange={(event) =>
                    setVehicleSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search vehicle or plate..."
                  className="
                    h-10
                    w-full
                    rounded-lg
                    border
                    border-[#2B2B30]
                    bg-[#17171A]
                    pl-9 pr-3
                    text-sm
                    text-white
                    outline-none
                    placeholder:text-zinc-600
                    focus:border-[#C8F065]/50
                  "
                />

              </div>


              <div
                className="
                  mt-2
                  max-h-52
                  overflow-y-auto
                  rounded-lg
                  border
                  border-[#2B2B30]
                  bg-[#17171A]
                "
              >

                {filteredVehicles.map(
                  (vehicle) => {

                    const selected =
                      Number(
                        form.vehicle_id
                      ) ===
                      vehicle.id;

                    const statusStyle =
                      getVehicleStatusStyle(
                        vehicle.status
                      );

                    return (
                      <button
                        key={
                          vehicle.id
                        }
                        type="button"
                        onClick={() =>
                          setForm(
                            (current) => ({
                              ...current,
                              vehicle_id:
                                String(
                                  vehicle.id
                                ),
                            })
                          )
                        }
                        className={`
                          flex
                          w-full
                          items-center
                          justify-between
                          gap-3
                          border-b
                          border-[#2B2B30]
                          px-3
                          py-3
                          text-left
                          last:border-0
                          hover:bg-[#1D1D20]
                          ${
                            selected
                              ? "bg-[#C8F065]/[0.04]"
                              : ""
                          }
                        `}
                      >

                        <div className="min-w-0">

                          <div
                            className="
                              truncate
                              text-sm
                              font-medium
                              text-white
                            "
                          >
                            {vehicle.name}
                          </div>

                          {vehicle.license_plate && (
                            <div
                              className="
                                mt-0.5
                                text-[10px]
                                text-zinc-600
                              "
                            >
                              {
                                vehicle.license_plate
                              }
                            </div>
                          )}

                        </div>


                        <div
                          className={`
                            flex
                            shrink-0
                            items-center
                            gap-1.5
                            rounded-full
                            border
                            px-2
                            py-1
                            text-[9px]
                            font-medium
                            ${statusStyle.border}
                            ${statusStyle.bg}
                            ${statusStyle.text}
                          `}
                        >

                          <span
                            className={`
                              h-1.5
                              w-1.5
                              rounded-full
                              ${statusStyle.dot}
                            `}
                          />

                          {vehicle.status ||
                            "No status"}

                        </div>


                        {selected && (
                          <Check
                            size={15}
                            className="
                              shrink-0
                              text-[#C8F065]
                            "
                          />
                        )}

                      </button>
                    );

                  }
                )}

              </div>

            </section>


            {/* =================================================
                PRODUCTS
            ================================================= */}

            <section>

              <div className="mb-3">

                <div
                  className="
                    text-xs
                    font-medium
                    text-white
                  "
                >
                  Sales & inventory
                </div>

                <p
                  className="
                    mt-1
                    text-[11px]
                    text-zinc-600
                  "
                >
                  Products and rental services come
                  directly from Odoo Sales.
                </p>

              </div>


              <div className="relative">

                <Search
                  size={14}
                  className="
                    absolute
                    left-3
                    top-1/2
                    -translate-y-1/2
                    text-zinc-600
                  "
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
                  className="
                    h-10
                    w-full
                    rounded-lg
                    border
                    border-[#2B2B30]
                    bg-[#17171A]
                    pl-9 pr-3
                    text-sm
                    text-white
                    outline-none
                    placeholder:text-zinc-600
                    focus:border-[#C8F065]/50
                  "
                />

              </div>


              <select
                required
                value={
                  form.product_id
                }
                onChange={(event) => {

                  setForm(
                    (current) => ({
                      ...current,
                      product_id:
                        event.target
                          .value,
                    })
                  );

                  setOptionalProductIds(
                    []
                  );

                }}
                className="
                  mt-2
                  h-10
                  w-full
                  rounded-lg
                  border
                  border-[#2B2B30]
                  bg-[#17171A]
                  px-3
                  text-sm
                  text-white
                  outline-none
                  focus:border-[#C8F065]/50
                "
              >

                <option value="">
                  Select rental product / service
                </option>

                {filteredProducts.map(
                  (product) => (
                    <option
                      key={
                        product.id
                      }
                      value={
                        product.id
                      }
                    >
                      {product.name}
                      {" — "}
                      {product.list_price.toLocaleString()}
                      {" TND"}
                    </option>
                  )
                )}

              </select>


              {/* SUGGESTED PRODUCTS */}

              {suggestedProducts.length >
                0 && (

                <div
                  className="
                    mt-3
                    rounded-xl
                    border
                    border-[#C8F065]/10
                    bg-[#C8F065]/[0.025]
                    p-3
                  "
                >

                  <div
                    className="
                      mb-2
                      text-[10px]
                      font-semibold
                      uppercase
                      tracking-wider
                      text-[#C8F065]
                    "
                  >
                    Suggested by Odoo
                  </div>

                  <div
                    className="
                      grid
                      gap-2
                      sm:grid-cols-2
                    "
                  >

                    {suggestedProducts.map(
                      (product) => {

                        const selected =
                          optionalProductIds.includes(
                            product.id
                          );

                        return (
                          <button
                            key={
                              product.id
                            }
                            type="button"
                            onClick={() =>
                              toggleOptionalProduct(
                                product.id
                              )
                            }
                            className={`
                              flex
                              items-center
                              justify-between
                              gap-3
                              rounded-lg
                              border
                              px-3
                              py-2.5
                              text-left
                              transition
                              ${
                                selected
                                  ? "border-[#C8F065]/40 bg-[#C8F065]/10"
                                  : "border-[#2B2B30] bg-[#17171A] hover:border-[#3A3A40]"
                              }
                            `}
                          >

                            <div>

                              <div
                                className="
                                  text-xs
                                  font-medium
                                  text-white
                                "
                              >
                                {product.name}
                              </div>

                              <div
                                className="
                                  mt-0.5
                                  text-[10px]
                                  text-zinc-600
                                "
                              >
                                {product.list_price.toLocaleString()}
                                {" TND"}
                              </div>

                            </div>

                            {selected && (
                              <Check
                                size={14}
                                className="
                                  text-[#C8F065]
                                "
                              />
                            )}

                          </button>
                        );

                      }
                    )}

                  </div>

                </div>

              )}

            </section>


            {/* =================================================
                DATES
            ================================================= */}

            <section>

              <div className="mb-3">

                <div
                  className="
                    flex
                    items-center
                    gap-2
                    text-xs
                    font-medium
                    text-white
                  "
                >
                  <CalendarDays
                    size={14}
                    className="text-[#C8F065]"
                  />

                  Rental period

                </div>

                <p
                  className="
                    mt-1
                    text-[11px]
                    text-zinc-600
                  "
                >
                  These dates become the rental
                  period used by the calendar.
                </p>

              </div>


              <div
                className="
                  grid
                  gap-4
                  sm:grid-cols-2
                "
              >

                <label
                  className="
                    space-y-1.5
                    text-xs
                    text-zinc-400
                  "
                >

                  Start date

                  <input
                    required
                    type="date"
                    value={
                      form.start_date
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          start_date:
                            event.target
                              .value,
                        })
                      )
                    }
                    className="
                      h-10
                      w-full
                      rounded-lg
                      border
                      border-[#2B2B30]
                      bg-[#17171A]
                      px-3
                      text-sm
                      text-white
                      outline-none
                      focus:border-[#C8F065]/50
                    "
                  />

                </label>


                <label
                  className="
                    space-y-1.5
                    text-xs
                    text-zinc-400
                  "
                >

                  Return date

                  <input
                    required
                    type="date"
                    value={
                      form.end_date
                    }
                    min={
                      form.start_date ||
                      undefined
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          end_date:
                            event.target
                              .value,
                        })
                      )
                    }
                    className="
                      h-10
                      w-full
                      rounded-lg
                      border
                      border-[#2B2B30]
                      bg-[#17171A]
                      px-3
                      text-sm
                      text-white
                      outline-none
                      focus:border-[#C8F065]/50
                    "
                  />

                </label>

              </div>

            </section>


            {/* =================================================
                PRICING
            ================================================= */}

            <section
              className="
                grid
                gap-4
                sm:grid-cols-2
              "
            >

              <label
                className="
                  space-y-1.5
                  text-xs
                  text-zinc-400
                "
              >

                Quantity

                <input
                  required
                  min="0.01"
                  step="0.01"
                  type="number"
                  value={
                    form.quantity
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        quantity:
                          event.target
                            .value,
                      })
                    )
                  }
                  className="
                    h-10
                    w-full
                    rounded-lg
                    border
                    border-[#2B2B30]
                    bg-[#17171A]
                    px-3
                    text-sm
                    text-white
                    outline-none
                    focus:border-[#C8F065]/50
                  "
                />

              </label>


              <label
                className="
                  space-y-1.5
                  text-xs
                  text-zinc-400
                "
              >

                Unit price
                <span className="text-zinc-600">
                  {" "}optional
                </span>

                <input
                  min="0"
                  step="0.001"
                  type="number"
                  value={
                    form.unit_price
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        unit_price:
                          event.target
                            .value,
                      })
                    )
                  }
                  placeholder="Use Odoo price"
                  className="
                    h-10
                    w-full
                    rounded-lg
                    border
                    border-[#2B2B30]
                    bg-[#17171A]
                    px-3
                    text-sm
                    text-white
                    outline-none
                    placeholder:text-zinc-600
                    focus:border-[#C8F065]/50
                  "
                />

              </label>

            </section>


            {/* =================================================
                ERROR
            ================================================= */}

            {error && (

              <div
                className="
                  rounded-xl
                  border
                  border-red-900/40
                  bg-red-950/20
                  px-3
                  py-3
                  text-sm
                  text-red-300
                "
              >
                {error}
              </div>

            )}


            {/* =================================================
                FOOTER
            ================================================= */}

            <div
              className="
                flex
                items-center
                justify-between
                gap-3
                border-t
                border-[#2B2B30]
                pt-5
              "
            >

              <div
                className="
                  hidden
                  text-[10px]
                  text-zinc-600
                  sm:block
                "
              >
                Odoo Sales + Fleet + CRM
              </div>


              <div
                className="
                  ml-auto
                  flex
                  gap-3
                "
              >

                <button
                  type="button"
                  onClick={
                    onClose
                  }
                  className="
                    h-9
                    rounded-lg
                    px-4
                    text-xs
                    font-medium
                    text-zinc-400
                    transition
                    hover:bg-[#1B1B1E]
                    hover:text-white
                  "
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  disabled={
                    submitting ||
                    !options
                  }
                  className="
                    flex
                    h-9
                    items-center
                    gap-2
                    rounded-lg
                    bg-[#C8F065]
                    px-4
                    text-xs
                    font-semibold
                    text-black
                    transition
                    hover:bg-[#d7ff80]
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >

                  {submitting && (
                    <LoaderCircle
                      size={14}
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