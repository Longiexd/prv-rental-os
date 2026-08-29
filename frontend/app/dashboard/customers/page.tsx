"use client";

import {
  Mail,
  MoreHorizontal,
  Phone,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";


type Customer = {
  id: number;
  name: string;
  phone: string | false;
  email: string | false;
  mobile: string | false;
};

type CustomersResponse = {
  count: number;
  customers: Customer[];
};


const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.rental-os.klynx.net";


export default function CustomersPage() {

  const [customers, setCustomers] =
    useState<Customer[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [showCreate, setShowCreate] =
    useState(false);

  const [creating, setCreating] =
    useState(false);

  const [createError, setCreateError] =
    useState("");

  const [name, setName] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [description, setDescription] =
    useState("");


  async function loadCustomers() {

    try {

      setLoading(true);
      setError("");

      const response =
        await fetch(`${API_URL}/customers`, {
          cache: "no-store",
        });

      if (!response.ok) {
        throw new Error(
          `API returned ${response.status}`
        );
      }

      const data: CustomersResponse =
        await response.json();

      setCustomers(
        Array.isArray(data.customers)
          ? data.customers
          : []
      );

    } catch (err) {

      console.error(
        "Failed to load customers:",
        err
      );

      setError(
        "Unable to load customer data."
      );

    } finally {

      setLoading(false);

    }
  }


  useEffect(() => {
    loadCustomers();
  }, []);


  const filteredCustomers =
    useMemo(() => {

      const query =
        search.toLowerCase().trim();

      if (!query) {
        return customers;
      }

      return customers.filter(
        (customer) => {

          return (
            customer.name
              ?.toLowerCase()
              .includes(query) ||

            String(
              customer.phone || ""
            )
              .toLowerCase()
              .includes(query) ||

            String(
              customer.mobile || ""
            )
              .toLowerCase()
              .includes(query) ||

            String(
              customer.email || ""
            )
              .toLowerCase()
              .includes(query)
          );
        }
      );

    }, [customers, search]);


  function resetForm() {

    setName("");
    setPhone("");
    setEmail("");
    setDescription("");
    setCreateError("");

  }


  function closeCreate() {

    if (creating) {
      return;
    }

    setShowCreate(false);
    resetForm();

  }


  async function handleCreateCustomer(
    event: React.FormEvent
  ) {

    event.preventDefault();

    if (!name.trim()) {

      setCreateError(
        "Customer name is required."
      );

      return;
    }

    try {

      setCreating(true);
      setCreateError("");

      const response =
        await fetch(
          `${API_URL}/customers/create`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              name: name.trim(),
              phone:
                phone.trim() || null,
              email:
                email.trim() || null,
              description:
                description.trim() || null,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {

        throw new Error(
          data?.detail ||
            "Unable to create customer."
        );
      }

      setShowCreate(false);
      resetForm();

      await loadCustomers();

    } catch (err) {

      console.error(
        "Customer creation failed:",
        err
      );

      setCreateError(
        err instanceof Error
          ? err.message
          : "Unable to create customer."
      );

    } finally {

      setCreating(false);

    }
  }


  return (
    <main className="mx-auto max-w-[1500px] p-5 sm:p-8">

      {/* HEADER */}

      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">

        <div>

          <div className="mb-2 flex items-center gap-2 text-[11px] text-[#71717A]">
            <span>Workspace</span>
            <span>/</span>
            <span className="text-[#A1A1AA]">
              Customers
            </span>
          </div>

          <h1 className="font-[Syne] text-[26px] font-semibold tracking-[-0.035em] sm:text-[30px]">
            Customers
          </h1>

          <p className="mt-1 text-sm text-[#71717A]">
            Manage customers, contact information and rental history.
          </p>

        </div>

        <button
          onClick={() => {
            resetForm();
            setShowCreate(true);
          }}
          className="flex h-9 items-center justify-center gap-2 rounded-lg bg-[#C8F065] px-4 text-xs font-medium text-[#09090B] transition hover:bg-[#d7ff80]"
        >
          <UserPlus size={14} />
          Add customer
        </button>

      </section>


      {/* STATS */}

      <section className="mt-7 grid gap-3 sm:grid-cols-2">

        <StatCard
          icon={<Users size={15} />}
          label="Total customers"
          value={customers.length.toString()}
          detail="contacts"
        />

        <StatCard
          icon={<UserPlus size={15} />}
          label="Showing"
          value={filteredCustomers.length.toString()}
          detail="customers"
          accent="pink"
        />

      </section>


      {/* CUSTOMER TABLE */}

      <section className="mt-4 overflow-hidden rounded-xl border border-[#2B2B30] bg-[#111113]/80">

        <div className="flex flex-col gap-3 border-b border-[#2B2B30] p-4 sm:flex-row sm:items-center sm:justify-between">

          <div>

            <h2 className="font-[Syne] text-sm font-semibold">
              Customer directory
            </h2>

            <p className="mt-1 text-[11px] text-[#71717A]">
              Live customer data from Odoo
            </p>

          </div>

          <div className="relative w-full sm:w-[260px]">

            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search customers..."
              className="h-9 w-full rounded-lg border border-[#2B2B30] bg-[#17171A] pl-9 pr-3 text-xs text-white outline-none placeholder:text-[#52525B] focus:border-[#C8F065]/40"
            />

          </div>

        </div>


        {loading && (

          <div className="p-10 text-center text-xs text-[#71717A]">
            Loading customers...
          </div>

        )}


        {!loading && error && (

          <div className="p-10 text-center text-xs text-[#F06AAA]">
            {error}
          </div>

        )}


        {!loading && !error && (

          <div className="overflow-x-auto">

            <table className="w-full min-w-[750px] text-left">

              <thead>

                <tr className="border-b border-[#2B2B30] text-[10px] uppercase tracking-wider text-[#71717A]">

                  <th className="px-5 py-3 font-medium">
                    Customer
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Phone
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Mobile
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Email
                  </th>

                  <th className="px-5 py-3" />

                </tr>

              </thead>


              <tbody className="divide-y divide-[#2B2B30]">

                {filteredCustomers.map(
                  (customer) => (

                    <tr
                      key={customer.id}
                      className="text-xs transition hover:bg-[#17171A]/50"
                    >

                      <td className="px-5 py-4">

                        <div className="flex items-center gap-3">

                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C8F065]/10 text-[10px] font-semibold text-[#C8F065]">
                            {getInitials(
                              customer.name
                            )}
                          </div>

                          <div>

                            <div className="font-medium">
                              {customer.name}
                            </div>

                            <div className="mt-0.5 text-[9px] text-[#52525B]">
                              ID #{customer.id}
                            </div>

                          </div>

                        </div>

                      </td>


                      <td className="px-5 py-4 text-[#A1A1AA]">

                        <div className="flex items-center gap-2">

                          <Phone
                            size={12}
                            className="text-[#71717A]"
                          />

                          {customer.phone || "—"}

                        </div>

                      </td>


                      <td className="px-5 py-4 text-[#A1A1AA]">
                        {customer.mobile || "—"}
                      </td>


                      <td className="px-5 py-4 text-[#A1A1AA]">

                        <div className="flex items-center gap-2">

                          <Mail
                            size={12}
                            className="text-[#71717A]"
                          />

                          {customer.email || "—"}

                        </div>

                      </td>


                      <td className="px-5 py-4 text-right">

                        <button className="text-[#71717A] transition hover:text-white">
                          <MoreHorizontal size={15} />
                        </button>

                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>


            {filteredCustomers.length === 0 && (

              <div className="p-10 text-center text-xs text-[#71717A]">
                No customers found.
              </div>

            )}

          </div>

        )}

      </section>


      {/* CREATE CUSTOMER MODAL */}

      {showCreate && (

        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeCreate();
            }
          }}
        >

          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#2B2B30] bg-[#111113] shadow-2xl">

            <div className="flex items-center justify-between border-b border-[#2B2B30] px-5 py-4">

              <div>

                <h2 className="font-[Syne] text-sm font-semibold">
                  Add customer
                </h2>

                <p className="mt-1 text-[11px] text-[#71717A]">
                  Creates the contact and connects it to CRM.
                </p>

              </div>

              <button
                onClick={closeCreate}
                className="rounded-lg p-2 text-[#71717A] transition hover:bg-[#17171A] hover:text-white"
              >
                <X size={16} />
              </button>

            </div>


            <form
              onSubmit={handleCreateCustomer}
              className="space-y-4 p-5"
            >

              {createError && (

                <div className="rounded-lg border border-[#F06AAA]/20 bg-[#F06AAA]/5 px-3 py-2 text-xs text-[#F06AAA]">
                  {createError}
                </div>

              )}


              <Field
                label="Name"
                value={name}
                onChange={setName}
                placeholder="Customer name"
                required
              />

              <Field
                label="Phone"
                value={phone}
                onChange={setPhone}
                placeholder="+216 ..."
              />

              <Field
                label="Email"
                value={email}
                onChange={setEmail}
                placeholder="customer@email.com"
                type="email"
              />


              <div>

                <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-[#71717A]">
                  Notes
                </label>

                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(
                      event.target.value
                    )
                  }
                  rows={4}
                  placeholder="Optional notes..."
                  className="w-full resize-none rounded-lg border border-[#2B2B30] bg-[#17171A] px-3 py-2.5 text-xs text-white outline-none placeholder:text-[#52525B] focus:border-[#C8F065]/40"
                />

              </div>


              <div className="flex justify-end gap-2 pt-2">

                <button
                  type="button"
                  onClick={closeCreate}
                  className="rounded-lg border border-[#2B2B30] bg-[#17171A] px-4 py-2.5 text-xs text-[#A1A1AA] transition hover:text-white"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-[#C8F065] px-4 py-2.5 text-xs font-medium text-[#09090B] transition hover:bg-[#d7ff80] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating
                    ? "Creating..."
                    : "Create customer"}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </main>
  );
}


function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
}) {

  return (
    <div>

      <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-[#71717A]">
        {label}
      </label>

      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#17171A] px-3 text-xs text-white outline-none placeholder:text-[#52525B] focus:border-[#C8F065]/40"
      />

    </div>
  );
}


function StatCard({
  icon,
  label,
  value,
  detail,
  accent = "green",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  accent?: "green" | "pink";
}) {

  const isPink =
    accent === "pink";

  return (

    <div className="relative overflow-hidden rounded-xl border border-[#2B2B30] bg-[#111113]/80 p-5">

      <div
        className={`absolute -right-10 -top-10 h-24 w-24 rounded-full blur-3xl ${
          isPink
            ? "bg-[#F06AAA]/[0.05]"
            : "bg-[#C8F065]/[0.05]"
        }`}
      />

      <div className="relative">

        <div className="flex items-center gap-2 text-[11px] text-[#71717A]">

          <span
            className={
              isPink
                ? "text-[#F06AAA]"
                : "text-[#C8F065]"
            }
          >
            {icon}
          </span>

          {label}

        </div>

        <div className="mt-5 flex items-baseline gap-2">

          <span className="font-[Syne] text-[26px] font-semibold">
            {value}
          </span>

          <span className="text-[10px] text-[#71717A]">
            {detail}
          </span>

        </div>

      </div>

    </div>
  );
}


function getInitials(name: string) {

  if (!name) {
    return "?";
  }

  const parts =
    name.trim().split(/\s+/);

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`
    .toUpperCase();
}