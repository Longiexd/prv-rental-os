import React from "react";
import OSLayout from "@/components/layout/OSLayout";

export default function CRMLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OSLayout>{children}</OSLayout>;
}