import OSLayout from "@/components/os/OSLayout";

export default function DashboardLayout({
 children
}: {
 children: React.ReactNode
}) {

 return (
   <OSLayout>
      {children}
   </OSLayout>
 )

}