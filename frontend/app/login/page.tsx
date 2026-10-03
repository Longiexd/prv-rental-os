"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

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
        setError(data.message || "Invalid username or password.");
        setLoading(false);
        return;
      }

      // Reload after login so no previous tenant's client state survives.
      window.location.assign("/dashboard");
    } catch {
      setError("Unable to sign in. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main
      className="
        relative
        flex
        min-h-screen
        items-center
        justify-center
        overflow-hidden
        bg-background
        px-6
        text-text
      "
    >
      {/* =========================================================
          AMBIENT BACKGROUND
      ========================================================= */}

      <div className="pointer-events-none absolute inset-0">
        <div
          className="
            absolute
            left-1/2
            top-[-250px]
            h-[600px]
            w-[600px]
            -translate-x-1/2
            rounded-full
            bg-[#C8F065]/[0.055]
            blur-[160px]
          "
        />

        <div
          className="
            absolute
            bottom-[-250px]
            right-[-100px]
            h-[500px]
            w-[500px]
            rounded-full
            bg-[#F06AAA]/[0.045]
            blur-[160px]
          "
        />
      </div>

      {/* =========================================================
          LOGIN
      ========================================================= */}

      <div className="relative w-full max-w-[390px]">
        {/* Logo */}

        <div className="mb-8 text-center">
          <Link
            href="/"
            className="
              font-[Syne]
              text-2xl
              font-semibold
              tracking-tight
            "
          >
            Klyn
            <span className="text-[#C8F065]">x</span>
            <span className="text-[#F06AAA]">OS</span>
          </Link>

          <p className="mt-2 text-sm text-muted">
            Rental business operating system
          </p>
        </div>

        {/* Card */}

        <div
          className="
            rounded-2xl
            border
            border-border
            bg-surface/90
            p-6
            shadow-card
            backdrop-blur-xl
          "
        >
          <div className="mb-6">
            <h1 className="font-[Syne] text-xl font-semibold">
              Welcome back
            </h1>

            <p className="mt-1 text-sm text-muted">
              Sign in to your workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}

            <div>
              <label
                htmlFor="username"
                className="mb-2 block text-xs text-text-secondary"
              >
                Username
              </label>

              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="company.username"
                className="
                  h-10
                  w-full
                  rounded-lg
                  border
                  border-border
                  bg-background
                  px-3
                  text-sm
                  outline-none
                  transition
                  placeholder:text-muted
                  focus:border-[#C8F065]/50
                "
              />
            </div>

            {/* Password */}

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-xs text-text-secondary"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="
                  h-10
                  w-full
                  rounded-lg
                  border
                  border-border
                  bg-background
                  px-3
                  text-sm
                  outline-none
                  transition
                  placeholder:text-muted
                  focus:border-[#C8F065]/50
                "
              />
            </div>

            {/* Error */}

            {error && (
              <div
                role="alert"
                className="
                  rounded-lg
                  border
                  border-[var(--status-danger-border)]
                  bg-[var(--status-danger-bg)]
                  px-3
                  py-2
                  text-xs
                  text-[var(--status-danger-text)]
                "
              >
                {error}
              </div>
            )}

            {/* Submit */}

            <button
              type="submit"
              disabled={loading}
              className="
                h-10
                w-full
                rounded-lg
                bg-[#C8F065]
                text-sm
                font-medium
                text-black
                transition
                hover:bg-[#d7ff80]
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              {loading ? "Opening workspace..." : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-[11px] text-muted">
          Klynx OS · Demo environment
        </p>
      </div>
    </main>
  );
}
