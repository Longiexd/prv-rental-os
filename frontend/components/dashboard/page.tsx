import {
  LayoutDashboard,
  Car,
  Users,
  Calendar,
  ClipboardList,
  ChartBar,
  Settings,
} from "lucide-react";


const menu = [
  {
    name:"Dashboard",
    icon:LayoutDashboard
  },
  {
    name:"Fleet",
    icon:Car
  },
  {
    name:"Customers",
    icon:Users
  },
  {
    name:"Rentals",
    icon:ClipboardList
  },
  {
    name:"Calendar",
    icon:Calendar
  },
  {
    name:"Analytics",
    icon:ChartBar
  },
];


export default function Dashboard(){


return (

<div className="
min-h-screen
bg-[#09090B]
text-white
flex
">


{/* SIDEBAR */}

<aside
className="
w-64
border-r
border-[#2B2B30]
bg-[#09090B]
p-6
"
>


<div
className="
font-[Syne]
text-xl
font-semibold
mb-10
"
>

Klyn
<span className="text-[#C8F065]">
x
</span>

<span className="text-[#F06AAA]">
OS
</span>

</div>



<div className="space-y-1">


{menu.map((item,index)=>{

const Icon=item.icon;


return (

<div
key={item.name}
className={`
flex
items-center
gap-3
px-3
py-2.5
rounded-lg
text-sm
cursor-pointer
transition

${
index===0
?
"bg-[#C8F065]/10 text-[#C8F065]"
:
"text-[#71717A] hover:bg-[#111113] hover:text-white"
}

`}
>

<Icon size={17}/>

{item.name}


</div>


)


})}



</div>


<div
className="
absolute
bottom-8
text-[#71717A]
flex
gap-2
items-center
text-sm
"
>

<Settings size={16}/>
Settings

</div>


</aside>





{/* MAIN */}

<div className="flex-1">



{/* TOP BAR */}

<header
className="
h-16
border-b
border-[#2B2B30]
flex
items-center
justify-between
px-8
"
>


<div
className="
text-sm
text-[#71717A]
"
>
Search vehicles, customers...
</div>



<div
className="
w-9
h-9
rounded-full
bg-[#111113]
border
border-[#2B2B30]
"
/>


</header>





<main className="p-8">



<h1
className="
font-[Syne]
text-3xl
font-semibold
"
>

Dashboard

</h1>


<p
className="
text-[#A1A1AA]
mt-2
"
>

Rental operation overview

</p>




{/* STATS */}

<div
className="
grid
grid-cols-3
gap-5
mt-8
"
>


{
[
["Vehicles","248"],
["Active Rentals","42"],
["Revenue","48K DT"]
].map(card=>(


<div
key={card[0]}
className="
rounded-xl
border
border-[#2B2B30]
bg-[#111113]
p-5
"
>


<p className="
text-sm
text-[#71717A]
">
{card[0]}
</p>


<p
className="
mt-3
font-[Syne]
text-3xl
"
>
{card[1]}
</p>


</div>


))
}


</div>






{/* LOWER GRID */}

<div
className="
grid
grid-cols-2
gap-5
mt-6
"
>



<div
className="
h-72
rounded-xl
border
border-[#2B2B30]
bg-[#111113]
p-5
"
>

<h2 className="font-[Syne]">
Fleet Activity
</h2>


<div
className="
mt-8
h-32
rounded-lg
bg-gradient-to-br
from-[#C8F065]/10
to-[#F06AAA]/10
"
/>


</div>





<div
className="
h-72
rounded-xl
border
border-[#2B2B30]
bg-[#111113]
p-5
"
>


<h2 className="font-[Syne]">
Recent Rentals
</h2>



<div className="mt-6 space-y-4">


{
[
"Kia Picanto",
"Peugeot 3008",
"BMW 220i"
].map(car=>(


<div
key={car}
className="
flex
justify-between
border-b
border-[#2B2B30]
pb-3
text-sm
"
>

<span>{car}</span>


<span
className="
text-[#C8F065]
"
>
Active
</span>


</div>


))
}


</div>


</div>



</div>




</main>


</div>



</div>


)

}