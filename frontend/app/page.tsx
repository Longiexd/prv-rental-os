import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#09090B] text-white overflow-hidden">

      {/* Ambient gradients */}
      <div className="absolute inset-0 -z-10">

        <div className="
          absolute
          top-[-250px]
          left-1/2
          -translate-x-1/2
          w-[700px]
          h-[500px]
          rounded-full
          bg-[#C8F065]/10
          blur-[160px]
        "/>

        <div className="
          absolute
          top-[300px]
          right-[-200px]
          w-[500px]
          h-[500px]
          rounded-full
          bg-[#F06AAA]/10
          blur-[180px]
        "/>

      </div>


      {/* NAVBAR */}

      <nav className="
        max-w-6xl
        mx-auto
        px-6
        py-6
        flex
        justify-between
        items-center
      ">

        <div className="
          font-[Syne]
          text-xl
          font-semibold
          tracking-tight
        ">

          Klyn<span className="text-[#C8F065]">x</span>
          <span className="text-[#F06AAA]">
            OS
          </span>

        </div>


        <Link
          href="/dashboard"
          className="
            text-sm
            rounded-lg
            border
            border-[#2B2B30]
            bg-[#111113]
            px-4
            py-2
            text-[#A1A1AA]
            hover:text-white
            hover:border-[#3b3b42]
            transition
          "
        >
          Launch OS
        </Link>


      </nav>



      {/* HERO */}

      <main className="max-w-6xl mx-auto px-6">


        <section className="
          pt-28
          text-center
        ">


          <div className="
            inline-flex
            items-center
            gap-2
            rounded-full
            border
            border-[#2B2B30]
            bg-[#111113]/70
            backdrop-blur
            px-3
            py-1.5
            text-xs
            text-[#A1A1AA]
          ">

            <span className="
              w-1.5
              h-1.5
              rounded-full
              bg-[#C8F065]
              shadow-[0_0_10px_#C8F065]
            "/>

            Rental Intelligence Platform

          </div>



          <h1 className="
            mt-8
            font-[Syne]
            text-5xl
            md:text-6xl
            font-semibold
            tracking-tight
            leading-[1.05]
          ">

            Your rental business.

            <br/>

            <span className="
              bg-gradient-to-r
              from-[#C8F065]
              via-white
              to-[#F06AAA]
              bg-clip-text
              text-transparent
            ">

              Operating as one system.

            </span>

          </h1>



          <p className="
            mt-6
            max-w-xl
            mx-auto
            text-base
            text-[#A1A1AA]
            leading-relaxed
          ">

            Klynx OS connects fleet, rentals, customers and analytics
            into a single intelligent workspace.

          </p>



          <div className="
            mt-8
            flex
            justify-center
          ">


            <Link
              href="/dashboard"
              className="
                group
                rounded-xl
                bg-[#C8F065]
                px-5
                py-2.5
                text-sm
                font-medium
                text-black
                hover:bg-[#d7ff80]
                transition
                shadow-[0_0_30px_rgba(200,240,101,0.15)]
              "
            >

              Open OS

              <span className="
                ml-2
                opacity-50
                group-hover:translate-x-1
                inline-block
                transition
              ">
                →
              </span>


            </Link>


          </div>


        </section>





        {/* APP PREVIEW */}


        <section className="
          mt-20
          pb-32
        ">


          <div className="
            rounded-2xl
            border
            border-[#2B2B30]
            bg-[#111113]/80
            backdrop-blur-xl
            p-2
            shadow-[0_30px_120px_rgba(0,0,0,.7)]
          ">


            <div className="
              rounded-xl
              border
              border-[#2B2B30]
              bg-[#09090B]
              overflow-hidden
            ">



              <div className="
                h-10
                border-b
                border-[#2B2B30]
                flex
                items-center
                px-4
                gap-2
              ">


                <div className="w-2 h-2 rounded-full bg-[#F06AAA]"/>
                <div className="w-2 h-2 rounded-full bg-[#C8F065]"/>


                <div className="
                  ml-4
                  text-xs
                  text-[#71717A]
                ">
                  klynx-os/dashboard
                </div>


              </div>





              <div className="
                p-8
                grid
                md:grid-cols-[170px_1fr]
                gap-8
              ">


                <aside className="space-y-2">


                  {[
                    "Dashboard",
                    "Fleet",
                    "Rentals",
                    "CRM",
                    "Calendar",
                    "Analytics"
                  ].map((x,i)=>(


                    <div
                      key={x}
                      className={`
                        px-3
                        py-2
                        rounded-lg
                        text-xs
                        ${
                          i === 0
                          ? "bg-[#C8F065]/10 text-[#C8F065]"
                          : "text-[#71717A]"
                        }
                      `}
                    >

                      {x}

                    </div>


                  ))}


                </aside>




                <div>


                  <div className="
                    grid
                    md:grid-cols-3
                    gap-4
                  ">


                    {[
                      ["Vehicles","248"],
                      ["Rentals","42"],
                      ["Revenue","48K"]
                    ].map(card=>(

                      <div
                        key={card[0]}
                        className="
                          rounded-xl
                          border
                          border-[#2B2B30]
                          bg-[#111113]
                          p-4
                        "
                      >

                        <p className="text-xs text-[#71717A]">
                          {card[0]}
                        </p>


                        <p className="
                          mt-3
                          text-2xl
                          font-[Syne]
                        ">
                          {card[1]}
                        </p>

                      </div>

                    ))}


                  </div>




                  <div className="
                    mt-4
                    h-40
                    rounded-xl
                    border
                    border-[#2B2B30]
                    bg-gradient-to-br
                    from-[#C8F065]/5
                    via-transparent
                    to-[#F06AAA]/5
                  "/>



                </div>



              </div>



            </div>


          </div>


        </section>


      </main>


    </div>
  );
}