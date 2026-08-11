"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, UserRound } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Invalid credentials");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#09090B] px-6 text-white">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-280px] h-[600px] w-[700px] -translate-x-1/2 rounded-full bg-[#C8F065]/[0.055] blur-[150px]" />

        <div className="absolute right-[-250px] top-[35%] h-[500px] w-[500px] rounded-full bg-[#F06AAA]/[0.04] blur-[160px]" />
      </div>

      <div className="relative z-10 w-full max-w-[390px]">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="font-[Syne] text-2xl font-semibold tracking-tight">
            Klyn
            <span className="text-[#C8F065]">x</span>
            <span className="text-[#F06AAA]">OS</span>
          </div>

          <p className="mt-3 text-sm text-[#71717A]">
            Business Operating System
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-2xl border border-[#2B2B30] bg-[#111113]/90 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="mb-7">
            <h1 className="font-[Syne] text-xl font-semibold">
              Welcome back
            </h1>

            <p className="mt-2 text-sm text-[#71717A]">
              Sign in to your rental workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="mb-2 block text-xs font-medium text-[#A1A1AA]">
                Username
              </label>

              <div className="relative">
                <UserRound
                  size={15}
                  strokeWidth={1.8}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]"
                />

                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#09090B] pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-[#52525B] focus:border-[#C8F065]/50 focus:ring-1 focus:ring-[#C8F065]/20"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="mb-2 block text-xs font-medium text-[#A1A1AA]">
                Password
              </label>

              <div className="relative">
                <LockKeyhole
                  size={15}
                  strokeWidth={1.8}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]"
                />

                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#09090B] pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-[#52525B] focus:border-[#C8F065]/50 focus:ring-1 focus:ring-[#C8F065]/20"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-[#F06AAA]/20 bg-[#F06AAA]/5 px-3 py-2.5 text-xs text-[#F06AAA]">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="group mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#C8F065] text-sm font-medium text-black shadow-[0_0_30px_rgba(200,240,101,0.12)] transition hover:bg-[#d7ff80] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Open workspace"}

              {!loading && (
                <ArrowRight
                  size={15}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              )}
            </button>
          </form>
        </div>

        {/* Demo hint */}
        <div className="mt-5 text-center text-[11px] text-[#52525B]">
          Demo access · admin / admin
        </div>
      </div>
    </main>
  );
}