import { NextResponse } from "next/server";
import { backendRequest } from "@/lib/backend-server";
import { COOKIE_NAME, COOKIE_OPTIONS, boundedBody, configuration, sameOrigin } from "@/lib/proxy-security.mjs";

function message(text: string, status: number) {
  return NextResponse.json({ success: false, message: text }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request, configuration(process.env).origin)) return message("Invalid request origin", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return message("JSON is required", 415);
    let body;
    try { body = JSON.parse(await boundedBody(request, 4096)); }
    catch { return message("Invalid request", 400); }
    if (typeof body?.username !== "string" || typeof body?.password !== "string") return message("Invalid request", 400);
    const upstream = await backendRequest("/auth/login", {
      method: "POST", body: JSON.stringify({ username: body.username, password: body.password }),
    }, request.headers.get("cf-connecting-ip") || "unknown");
    if (!upstream.ok) {
      const status = [401, 422, 429].includes(upstream.status) ? upstream.status : 503;
      return message(status === 429 ? "Too many attempts. Please wait a minute." : status === 503 ? "Company service unavailable" : "Invalid username or password", status);
    }
    const data = await upstream.json();
    if (typeof data.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(data.token)) return message("Company service unavailable", 503);
    const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(COOKIE_NAME, data.token, { ...COOKIE_OPTIONS, sameSite: "lax", maxAge: 8 * 3600 });
    // Expire the former demo cookie during the first migration login.
    response.cookies.set("klynx_session", "", { httpOnly: true, secure: true, path: "/", maxAge: 0 });
    return response;
  } catch {
    return message("Company service unavailable", 503);
  }
}

export async function DELETE(request: Request) {
  try {
    if (!sameOrigin(request, configuration(process.env).origin)) return message("Invalid request origin", 403);
    const upstream = await backendRequest("/auth/session", { method: "DELETE" });
    if (!upstream.ok) return message("Could not finish signing out. Please retry.", 503);
    const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(COOKIE_NAME, "", { ...COOKIE_OPTIONS, sameSite: "lax", maxAge: 0 });
    return response;
  } catch {
    return message("Could not finish signing out. Please retry.", 503);
  }
}
