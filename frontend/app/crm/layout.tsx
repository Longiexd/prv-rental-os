import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import OSLayout from "@/components/layout/OSLayout";

const SESSION_COOKIE = "klynx_session";
const SESSION_VALUE = "demo-admin-session";

export default async function CRMLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);

  if (session?.value !== SESSION_VALUE) {
    redirect("/login");
  }

  return <OSLayout>{children}</OSLayout>;
}