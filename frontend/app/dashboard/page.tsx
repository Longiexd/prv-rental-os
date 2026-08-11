import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Car,
  TrendingUp,
  Users,
} from "lucide-react";

type Vehicle = {
  id: number;
  name: string;
  license_plate?: string;
  model_id?: [number, string];
  state_id?: [number, string];
};

type DashboardData = {
  fleet: {
    total: number;
    available: number;
  };

  customers: number;

  recent_vehicles: Vehicle[];
};


async function getDashboardData(): Promise<DashboardData> {

  const backendUrl =
    process.env.BACKEND_URL || "http://backend:8000";

  const response = await fetch(
    `${backendUrl}/dashboard/overview`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("Unable to load dashboard data");
  }

  return response.json();
}


export default async function DashboardPage() {

  const data = await getDashboardData();


  const rented =
    Math.max(
      data.fleet.total - data.fleet.available,
      0
    );


  const utilization =
    data.fleet.total > 0
      ? Math.round(
          (rented / data.fleet.total) * 100
        )
      : 0;


  const stats = [
    {
      label: "Fleet",
      value: data.fleet.total,
      description: "vehicles",
      icon: Car,
      color: "lime",
    },
    {
      label: "Active rentals",
      value: rented,
      description: "currently rented",
      icon: CalendarDays,
      color: "lime",
    },
    {
      label: "Available",
      value: data.fleet.available,
      description: "ready to rent",
      icon: Activity,
      color: "pink",
    },
    {
      label: "Customers",
      value: data.customers,
      description: "customers",
      icon: Users,
      color: "lime",
    },
  ];


  return (
    <div className="mx-auto max-w-[1500px] px-6 py-8 lg:px-8">

      {/* =======================================================
          HEADER
      ======================================================= */}

      <div className="mb-8 flex items-end justify-between">

        <div>

          <div
            className="
              mb-3
              flex
              items-center
              gap-2
              text-[11px]
              text-[#71717A]
            "
          >
            <span>Workspace</span>

            <span>/</span>

            <span className="text-[#A1A1AA]">
              Overview
            </span>
          </div>


          <h1
            className="
              font-[Syne]
              text-3xl
              font-semibold
              tracking-tight
            "
          >
            Good afternoon.
          </h1>


          <p className="mt-2 text-sm text-[#71717A]">
            Here's what's happening with your rental operation.
          </p>

        </div>


        <button
          className="
            hidden
            items-center
            gap-2
            rounded-lg
            bg-[#C8F065]
            px-4
            py-2.5
            text-sm
            font-medium
            text-black
            shadow-[0_0_25px_rgba(200,240,101,.12)]
            transition
            hover:bg-[#d7ff80]
            sm:flex
          "
        >
          <CalendarDays size={15} />

          New rental
        </button>

      </div>


      {/* =======================================================
          STATISTICS
      ======================================================= */}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">

        {stats.map((stat) => {

          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className="
                group
                rounded-xl
                border
                border-[#2B2B30]
                bg-[#111113]
                p-5
                transition
                hover:border-[#3B3B42]
              "
            >

              <div className="flex items-center justify-between">

                <div className="flex items-center gap-2 text-xs text-[#71717A]">

                  <Icon
                    size={14}
                    className={
                      stat.color === "pink"
                        ? "text-[#F06AAA]"
                        : "text-[#C8F065]"
                    }
                  />

                  {stat.label}

                </div>


                <ArrowUpRight
                  size={14}
                  className="
                    text-[#52525B]
                    opacity-0
                    transition
                    group-hover:opacity-100
                  "
                />

              </div>


              <div className="mt-6 flex items-baseline gap-2">

                <span
                  className="
                    font-[Syne]
                    text-3xl
                    font-semibold
                  "
                >
                  {stat.value}
                </span>

                <span className="text-xs text-[#71717A]">
                  {stat.description}
                </span>

              </div>

            </div>
          );

        })}

      </div>


      {/* =======================================================
          MAIN GRID
      ======================================================= */}

      <div
        className="
          mt-4
          grid
          gap-4
          xl:grid-cols-[1.7fr_1fr]
        "
      >

        {/* =====================================================
            FLEET UTILIZATION
        ===================================================== */}

        <section
          className="
            overflow-hidden
            rounded-xl
            border
            border-[#2B2B30]
            bg-[#111113]
          "
        >

          <div
            className="
              flex
              items-center
              justify-between
              border-b
              border-[#2B2B30]
              px-5
              py-4
            "
          >

            <div>

              <h2 className="text-sm font-medium">
                Fleet utilization
              </h2>

              <p className="mt-1 text-[11px] text-[#71717A]">
                Current vehicle utilization
              </p>

            </div>


            <span
              className="
                rounded-md
                border
                border-[#2B2B30]
                px-2
                py-1
                text-[10px]
                text-[#71717A]
              "
            >
              Live
            </span>

          </div>


          <div className="p-5">

            <div className="flex items-end justify-between">

              <div>

                <div
                  className="
                    font-[Syne]
                    text-4xl
                    font-semibold
                  "
                >
                  {utilization}%
                </div>

                <div className="mt-1 text-xs text-[#71717A]">
                  fleet utilization
                </div>

              </div>


              <div className="text-xs text-[#C8F065]">
                {rented} rented
              </div>

            </div>


            {/* Chart */}

            <div className="relative mt-8 h-[180px] overflow-hidden">

              <div className="absolute inset-x-0 top-0 border-t border-[#2B2B30]" />

              <div className="absolute inset-x-0 top-1/3 border-t border-[#2B2B30]" />

              <div className="absolute inset-x-0 top-2/3 border-t border-[#2B2B30]" />

              <div className="absolute inset-x-0 bottom-0 border-t border-[#2B2B30]" />


              <div
                className="
                  absolute
                  bottom-0
                  left-0
                  h-[70%]
                  w-full
                  bg-gradient-to-t
                  from-[#C8F065]/[0.02]
                  to-[#C8F065]/[0.14]
                "
                style={{
                  clipPath:
                    "polygon(0 70%, 10% 66%, 20% 60%, 30% 62%, 40% 50%, 50% 54%, 60% 38%, 70% 42%, 80% 28%, 90% 32%, 100% 15%, 100% 100%, 0 100%)",
                }}
              />


              <div
                className="
                  absolute
                  bottom-0
                  left-0
                  h-[70%]
                  w-full
                  border-t-2
                  border-[#C8F065]
                "
                style={{
                  clipPath:
                    "polygon(0 70%, 10% 66%, 20% 60%, 30% 62%, 40% 50%, 50% 54%, 60% 38%, 70% 42%, 80% 28%, 90% 32%, 100% 15%)",
                }}
              />

            </div>

          </div>

        </section>


        {/* =====================================================
            FLEET OVERVIEW
        ===================================================== */}

        <section
          className="
            overflow-hidden
            rounded-xl
            border
            border-[#2B2B30]
            bg-[#111113]
          "
        >

          <div className="border-b border-[#2B2B30] px-5 py-4">

            <h2 className="text-sm font-medium">
              Fleet overview
            </h2>

            <p className="mt-1 text-[11px] text-[#71717A]">
              Live records from Odoo
            </p>

          </div>


          <div>

            {data.recent_vehicles.length === 0 ? (

              <div className="px-5 py-10 text-center text-xs text-[#71717A]">
                No vehicles found.
              </div>

            ) : (

              data.recent_vehicles
                .slice(0, 5)
                .map((vehicle) => (

                  <div
                    key={vehicle.id}
                    className="
                      flex
                      items-center
                      justify-between
                      border-b
                      border-[#2B2B30]
                      px-5
                      py-4
                      last:border-0
                    "
                  >

                    <div className="flex items-center gap-3">

                      <div
                        className="
                          flex
                          h-8
                          w-8
                          items-center
                          justify-center
                          rounded-lg
                          bg-[#C8F065]/10
                        "
                      >
                        <Car
                          size={14}
                          className="text-[#C8F065]"
                        />
                      </div>


                      <div>

                        <div className="text-sm font-medium">
                          {vehicle.name}
                        </div>

                        <div className="mt-0.5 text-[10px] text-[#71717A]">
                          {vehicle.license_plate || "No plate"}
                        </div>

                      </div>

                    </div>


                    <span
                      className="
                        rounded-md
                        bg-[#C8F065]/10
                        px-2
                        py-1
                        text-[10px]
                        text-[#C8F065]
                      "
                    >
                      {vehicle.state_id?.[1] || "Unknown"}
                    </span>

                  </div>

                ))

            )}

          </div>

        </section>

      </div>


      {/* =======================================================
          VEHICLES TABLE
      ======================================================= */}

      <section
        className="
          mt-4
          overflow-hidden
          rounded-xl
          border
          border-[#2B2B30]
          bg-[#111113]
        "
      >

        <div
          className="
            flex
            items-center
            justify-between
            border-b
            border-[#2B2B30]
            px-5
            py-4
          "
        >

          <div>

            <h2 className="text-sm font-medium">
              Vehicles
            </h2>

            <p className="mt-1 text-[11px] text-[#71717A]">
              Fleet records from Odoo
            </p>

          </div>


          <button
            className="
              text-xs
              text-[#A1A1AA]
              transition
              hover:text-[#C8F065]
            "
          >
            View all →
          </button>

        </div>


        <div className="overflow-x-auto">

          <table className="w-full text-left">

            <thead>

              <tr
                className="
                  border-b
                  border-[#2B2B30]
                  text-[10px]
                  uppercase
                  tracking-wider
                  text-[#71717A]
                "
              >

                <th className="px-5 py-3 font-medium">
                  Vehicle
                </th>

                <th className="px-5 py-3 font-medium">
                  Model
                </th>

                <th className="px-5 py-3 font-medium">
                  Plate
                </th>

                <th className="px-5 py-3 font-medium">
                  Status
                </th>

              </tr>

            </thead>


            <tbody>

              {data.recent_vehicles.map((vehicle) => (

                <tr
                  key={vehicle.id}
                  className="
                    border-b
                    border-[#2B2B30]
                    last:border-0
                  "
                >

                  <td className="px-5 py-4 text-sm font-medium">
                    {vehicle.name}
                  </td>

                  <td className="px-5 py-4 text-xs text-[#A1A1AA]">
                    {vehicle.model_id?.[1] || "—"}
                  </td>

                  <td
                    className="
                      px-5
                      py-4
                      font-mono
                      text-xs
                      text-[#A1A1AA]
                    "
                  >
                    {vehicle.license_plate || "—"}
                  </td>

                  <td className="px-5 py-4">

                    <span
                      className="
                        rounded-md
                        bg-[#C8F065]/10
                        px-2
                        py-1
                        text-[10px]
                        text-[#C8F065]
                      "
                    >
                      {vehicle.state_id?.[1] || "Unknown"}
                    </span>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </section>

    </div>
  );
}