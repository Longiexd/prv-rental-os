"use client";

import { useState } from "react";
import { Loader2, Mail, Phone, Plus, UserRound, X } from "lucide-react";

type AddLeadModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.rental-os.klynx.net";

export default function AddLeadModal({
  open,
  onClose,
  onCreated,
}: AddLeadModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  function resetForm() {
    setName("");
    setPhone("");
    setEmail("");
    setDescription("");
    setError(null);
  }

  function handleClose() {
    if (saving) return;

    resetForm();
    onClose();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Lead name is required.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`${API_URL}/crm/leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          description: description.trim() || null,
        }),
      });

      if (!response.ok) {
        let message = `Lead API returned ${response.status}`;

        try {
          const data = await response.json();

          if (typeof data?.detail === "string") {
            message = data.detail;
          }
        } catch {
          // Keep the HTTP status message.
        }

        throw new Error(message);
      }

      resetForm();
      onClose();
      onCreated?.();
    } catch (err) {
      console.error("Failed to create lead:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create lead."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#2B2B30] bg-[#111113] shadow-[0_30px_100px_rgba(0,0,0,.55)]">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-[#2B2B30] px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C8F065]/10 text-[#C8F065]">
                <UserRound size={16} />
              </div>

              <div>
                <h2 className="font-[Syne] text-sm font-semibold text-white">
                  Add Lead
                </h2>

                <p className="mt-0.5 text-[10px] text-[#71717A]">
                  Create a new CRM lead in Odoo
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#71717A] transition hover:bg-[#17171A] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 p-5">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-[#A1A1AA]">
                Lead name
              </label>

              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Ahmed Ben Ali"
                className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#09090B] px-3 text-sm text-white outline-none placeholder:text-[#52525B] transition focus:border-[#C8F065]/50"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-[#A1A1AA]">
                  Phone
                </label>

                <div className="relative">
                  <Phone
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525B]"
                  />

                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+216 ..."
                    className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#09090B] pl-9 pr-3 text-sm text-white outline-none placeholder:text-[#52525B] transition focus:border-[#C8F065]/50"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-[#A1A1AA]">
                  Email
                </label>

                <div className="relative">
                  <Mail
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525B]"
                  />

                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="client@email.com"
                    className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#09090B] pl-9 pr-3 text-sm text-white outline-none placeholder:text-[#52525B] transition focus:border-[#C8F065]/50"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-[#A1A1AA]">
                Notes
              </label>

              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder="Rental requirements, source, follow-up notes..."
                rows={4}
                className="w-full resize-none rounded-lg border border-[#2B2B30] bg-[#09090B] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#52525B] transition focus:border-[#C8F065]/50"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-[#F06AAA]/30 bg-[#F06AAA]/5 px-3 py-2.5 text-xs text-[#F06AAA]">
                {error}
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div className="flex items-center justify-end gap-2 border-t border-[#2B2B30] px-5 py-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="h-9 rounded-lg border border-[#2B2B30] bg-[#17171A] px-4 text-xs font-medium text-[#A1A1AA] transition hover:text-white disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex h-9 items-center gap-2 rounded-lg bg-[#C8F065] px-4 text-xs font-semibold text-[#09090B] transition hover:bg-[#d7ff80] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}

              {saving ? "Creating..." : "Create Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}