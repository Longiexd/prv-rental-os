"use client";

import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  FileText,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { formatCurrency } from "@/lib/format";

type Customer = {
  id: number;
  name: string;
};

type MonthlyItem = {
  month: string;
  revenue: number;
  orders: number;
  average_order: number;
  invoiced: number;
  collected: number;
  outstanding: number;
};

type CategoryItem = {
  name: string;
  revenue: number;
  quantity: number;
};

type ProductItem = {
  id: number;
  name: string;
  category: string;
  revenue: number;
  quantity: number;
};

type Transaction = {
  id: number;
  name: string;
  date: string | null;
  customer: Customer | null;
  amount: number;
  state: string;
  invoice_status: string | null;
  products: string[];
  categories: string[];
};

type AnalyticsResponse = {
  year: number;
  summary: {
    revenue: number;
    orders: number;
    average_order: number;
    invoiced: number;
    collected: number;
    outstanding: number;
  };
  monthly: MonthlyItem[];
  categories: CategoryItem[];
  products: ProductItem[];
  transactions: Transaction[];
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.rental-os.klynx.net";

function monthLabel(value: string) {
  const date = new Date(`${value}-01T00:00:00`);

  return date.toLocaleDateString("en-US", {
    month: "short",
  });
}

function fullMonthLabel(value: string) {
  const date = new Date(`${value}-01T00:00:00`);

  return date.toLocaleDateString("en-US", {
    month: "long",
  });
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AnalyticsPage() {
  const currentYear =
    new Date().getFullYear();

  const [year, setYear] =
    useState(currentYear);

  const [monthFilter, setMonthFilter] =
    useState("all");

  const [categoryFilter, setCategoryFilter] =
    useState("all");

  const [search, setSearch] =
    useState("");

  const [sortBy, setSortBy] =
    useState<
      "date" | "amount" | "customer"
    >("date");

  const [sortDirection, setSortDirection] =
    useState<"asc" | "desc">("desc");

  const [data, setData] =
    useState<AnalyticsResponse | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function loadAnalytics() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/analytics?year=${year}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error(
          `Analytics API returned ${response.status}`
        );
      }

      const result: AnalyticsResponse =
        await response.json();

      setData(result);
    } catch (err) {
      console.error(
        "Failed to load analytics:",
        err
      );

      setError(
        "Unable to load business analytics."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, [year]);

  const visibleTransactions = useMemo(() => {
    if (!data) return [];

    const query = search.toLowerCase().trim();

    const result =
      data.transactions.filter(
        (transaction) => {
          const transactionMonth =
            transaction.date?.slice(0, 7);

          const matchesMonth =
            monthFilter === "all" ||
            transactionMonth ===
              monthFilter;

          const matchesCategory =
            categoryFilter === "all" ||
            transaction.categories.includes(
              categoryFilter
            );

          const matchesSearch =
            !query ||
            transaction.name
              .toLowerCase()
              .includes(query) ||
            transaction.customer?.name
              .toLowerCase()
              .includes(query) ||
            transaction.products.some(
              (product) =>
                product
                  .toLowerCase()
                  .includes(query)
            );

          return (
            matchesMonth &&
            matchesCategory &&
            matchesSearch
          );
        }
      );

    return result.sort((a, b) => {
      let comparison = 0;

      if (sortBy === "amount") {
        comparison = a.amount - b.amount;
      } else if (sortBy === "customer") {
        comparison = (
          a.customer?.name || ""
        ).localeCompare(
          b.customer?.name || ""
        );
      } else {
        comparison =
          new Date(
            a.date || 0
          ).getTime() -
          new Date(
            b.date || 0
          ).getTime();
      }

      return sortDirection === "asc"
        ? comparison
        : -comparison;
    });
  }, [
    data,
    monthFilter,
    categoryFilter,
    search,
    sortBy,
    sortDirection,
  ]);

  const maxRevenue = useMemo(() => {
    if (!data?.monthly.length) return 1;

    return Math.max(
      ...data.monthly.map(
        (item) => item.revenue
      ),
      1
    );
  }, [data]);

  const summary = data?.summary;

  return (
    <main className="mx-auto max-w-[1600px] p-5 sm:p-8">
      <PageHeader
        breadcrumb="Analytics"
        title="Business analytics"
        subtitle="A simple financial view of how the rental business is performing."
        action={
          <select
            value={year}
            onChange={(event) =>
              setYear(
                Number(event.target.value)
              )
            }
            className="h-9 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-text outline-none"
          >
            {[
              currentYear - 2,
              currentYear - 1,
              currentYear,
              currentYear + 1,
            ].map((value) => (
              <option
                key={value}
                value={value}
              >
                {value}
              </option>
            ))}
          </select>
        }
      />

      {loading && (
        <div className="mt-8 text-center text-xs text-muted">
          Loading business analytics...
        </div>
      )}

      {!loading && error && (
        <div className="mt-8 text-center text-xs text-danger">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              icon={<CircleDollarSign size={15} />}
              label="Revenue"
              value={formatCurrency(
                summary?.revenue || 0
              )}
              detail="Confirmed sales"
            />

            <MetricCard
              icon={<FileText size={15} />}
              label="Invoiced"
              value={formatCurrency(
                summary?.invoiced || 0
              )}
              detail="Posted invoices"
            />

            <MetricCard
              icon={<TrendingUp size={15} />}
              label="Collected"
              value={formatCurrency(
                summary?.collected || 0
              )}
              detail="Paid value"
              tone="pink"
            />

            <MetricCard
              icon={<CircleDollarSign size={15} />}
              label="Outstanding"
              value={formatCurrency(
                summary?.outstanding || 0
              )}
              detail="Still to collect"
            />

            <MetricCard
              icon={<BarChart3 size={15} />}
              label="Average order"
              value={formatCurrency(
                summary?.average_order || 0
              )}
              detail={`${summary?.orders || 0} orders`}
            />
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[1.7fr_1fr]">
            <Card>
              <CardHeader
                title="Revenue by month"
                subtitle={`Monthly performance for ${year}`}
              />

              <div className="p-5">
                <div className="flex h-[260px] items-end gap-2 sm:gap-3">
                  {data.monthly.map(
                    (item) => {
                      const height =
                        item.revenue === 0
                          ? 4
                          : Math.max(
                              8,
                              Math.round(
                                (item.revenue /
                                  maxRevenue) *
                                  220
                              )
                            );

                      return (
                        <div
                          key={item.month}
                          className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2"
                        >
                          <div className="text-[9px] text-muted opacity-0 transition group-hover:opacity-100">
                            {formatCurrency(
                              item.revenue
                            )}
                          </div>

                          <div
                            className="w-full rounded-t-md bg-lime/80 transition group-hover:bg-lime"
                            style={{
                              height,
                            }}
                          />

                          <div className="text-[9px] text-muted">
                            {monthLabel(
                              item.month
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Product mix"
                subtitle="Revenue by product category"
              />

              <div className="space-y-3 p-5">
                {data.categories.length ===
                  0 && (
                  <p className="text-xs text-muted">
                    No product data for this year.
                  </p>
                )}

                {data.categories
                  .slice(0, 7)
                  .map((category) => {
                    const percentage =
                      summary?.revenue
                        ? Math.round(
                            (category.revenue /
                              summary.revenue) *
                              100
                          )
                        : 0;

                    return (
                      <div
                        key={category.name}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-xs text-text-secondary">
                            {category.name}
                          </span>

                          <span className="shrink-0 text-[10px] text-muted">
                            {percentage}%
                          </span>
                        </div>

                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-secondary">
                          <div
                            className="h-full rounded-full bg-pink"
                            style={{
                              width: `${percentage}%`,
                            }}
                          />
                        </div>

                        <div className="mt-1 text-[10px] text-muted">
                          {formatCurrency(
                            category.revenue
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Card>
          </section>

          <section className="mt-4">
            <Card>
              <CardHeader
                title="Monthly breakdown"
                subtitle="Revenue, billing and collections"
              />

              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-left">
                  <thead>
                    <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted">
                      <th className="px-5 py-3 font-medium">
                        Month
                      </th>
                      <th className="px-5 py-3 font-medium">
                        Revenue
                      </th>
                      <th className="px-5 py-3 font-medium">
                        Orders
                      </th>
                      <th className="px-5 py-3 font-medium">
                        Avg. order
                      </th>
                      <th className="px-5 py-3 font-medium">
                        Invoiced
                      </th>
                      <th className="px-5 py-3 font-medium">
                        Collected
                      </th>
                      <th className="px-5 py-3 font-medium">
                        Outstanding
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.monthly.map(
                      (item) => (
                        <tr
                          key={item.month}
                          className="border-b border-border last:border-0"
                        >
                          <td className="px-5 py-3 text-xs font-medium">
                            {fullMonthLabel(
                              item.month
                            )}
                          </td>

                          <td className="px-5 py-3 text-xs">
                            {formatCurrency(
                              item.revenue
                            )}
                          </td>

                          <td className="px-5 py-3 text-xs text-text-secondary">
                            {item.orders}
                          </td>

                          <td className="px-5 py-3 text-xs text-text-secondary">
                            {formatCurrency(
                              item.average_order
                            )}
                          </td>

                          <td className="px-5 py-3 text-xs text-text-secondary">
                            {formatCurrency(
                              item.invoiced
                            )}
                          </td>

                          <td className="px-5 py-3 text-xs text-lime">
                            {formatCurrency(
                              item.collected
                            )}
                          </td>

                          <td className="px-5 py-3 text-xs text-pink">
                            {formatCurrency(
                              item.outstanding
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          <section className="mt-4">
            <Card>
              <CardHeader
                title="Transactions"
                subtitle="Confirmed sales for the selected year"
              />

              <div className="border-b border-border p-4">
                <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
                  <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search orders, customers or products..."
                  />

                  <select
                    value={monthFilter}
                    onChange={(event) =>
                      setMonthFilter(
                        event.target.value
                      )
                    }
                    className="h-9 rounded-lg border border-border bg-surface px-3 text-xs text-text outline-none"
                  >
                    <option value="all">
                      All months
                    </option>

                    {data.monthly.map(
                      (item) => (
                        <option
                          key={item.month}
                          value={item.month}
                        >
                          {fullMonthLabel(
                            item.month
                          )}
                        </option>
                      )
                    )}
                  </select>

                  <select
                    value={categoryFilter}
                    onChange={(event) =>
                      setCategoryFilter(
                        event.target.value
                      )
                    }
                    className="h-9 rounded-lg border border-border bg-surface px-3 text-xs text-text outline-none"
                  >
                    <option value="all">
                      All categories
                    </option>

                    {data.categories.map(
                      (category) => (
                        <option
                          key={category.name}
                          value={category.name}
                        >
                          {category.name}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left">
                  <thead>
                    <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted">
                      <SortableHeader
                        label="Date"
                        active={
                          sortBy === "date"
                        }
                        direction={
                          sortDirection
                        }
                        onClick={() =>
                          toggleSort(
                            "date",
                            sortBy,
                            sortDirection,
                            setSortBy,
                            setSortDirection
                          )
                        }
                      />

                      <th className="px-5 py-3 font-medium">
                        Customer
                      </th>

                      <th className="px-5 py-3 font-medium">
                        Product
                      </th>

                      <th className="px-5 py-3 font-medium">
                        Category
                      </th>

                      <SortableHeader
                        label="Amount"
                        active={
                          sortBy === "amount"
                        }
                        direction={
                          sortDirection
                        }
                        onClick={() =>
                          toggleSort(
                            "amount",
                            sortBy,
                            sortDirection,
                            setSortBy,
                            setSortDirection
                          )
                        }
                      />
                    </tr>
                  </thead>

                  <tbody>
                    {visibleTransactions.map(
                      (transaction) => (
                        <tr
                          key={transaction.id}
                          className="border-b border-border last:border-0"
                        >
                          <td className="px-5 py-3 text-xs">
                            {formatDate(
                              transaction.date
                            )}
                          </td>

                          <td className="px-5 py-3 text-xs">
                            <div className="font-medium">
                              {transaction.customer
                                ?.name ||
                                "Unknown"}
                            </div>

                            <div className="mt-0.5 text-[10px] text-muted">
                              {transaction.name}
                            </div>
                          </td>

                          <td className="px-5 py-3 text-xs text-text-secondary">
                            {transaction.products
                              .slice(0, 2)
                              .join(", ") ||
                              "No product"}
                          </td>

                          <td className="px-5 py-3 text-[10px] text-muted">
                            {transaction.categories
                              .slice(0, 2)
                              .join(", ") ||
                              "Uncategorized"}
                          </td>

                          <td className="px-5 py-3 text-xs font-semibold">
                            {formatCurrency(
                              transaction.amount
                            )}
                          </td>
                        </tr>
                      )
                    )}

                    {visibleTransactions.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-5 py-12 text-center text-xs text-muted"
                        >
                          No transactions match the
                          current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-border px-5 py-3 text-[10px] text-muted">
                Showing{" "}
                {visibleTransactions.length}{" "}
                transaction
                {visibleTransactions.length === 1
                  ? ""
                  : "s"}
              </div>
            </Card>
          </section>
        </>
      )}
    </main>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone = "lime",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: "lime" | "pink";
}) {
  return (
    <Card>
      <div className="p-4">
        <div className="flex items-center gap-2 text-muted">
          <span
            className={
              tone === "pink"
                ? "text-pink"
                : "text-lime"
            }
          >
            {icon}
          </span>

          <span className="text-[10px] uppercase tracking-[0.12em]">
            {label}
          </span>
        </div>

        <div className="mt-3 font-syne text-xl font-semibold">
          {value}
        </div>

        <div className="mt-1 text-[10px] text-muted">
          {detail}
        </div>
      </div>
    </Card>
  );
}

function SortableHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th className="px-5 py-3">
      <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide ${
          active
            ? "text-text"
            : "text-muted"
        }`}
      >
        {label}

        {active ? (
          direction === "asc" ? (
            <ArrowUp size={11} />
          ) : (
            <ArrowDown size={11} />
          )
        ) : null}
      </button>
    </th>
  );
}

function toggleSort(
  field: "date" | "amount" | "customer",
  sortBy: "date" | "amount" | "customer",
  direction: "asc" | "desc",
  setSortBy: (
    value:
      | "date"
      | "amount"
      | "customer"
  ) => void,
  setDirection: (
    value: "asc" | "desc"
  ) => void
) {
  if (sortBy === field) {
    setDirection(
      direction === "asc"
        ? "desc"
        : "asc"
    );
    return;
  }

  setSortBy(field);
  setDirection("desc");
}