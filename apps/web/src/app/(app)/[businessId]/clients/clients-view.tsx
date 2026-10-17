"use client";

import type { Client } from "@billsafi/contracts";
import { formatKenyanPhone } from "@billsafi/domain";
import { Archive, Pencil, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientForm } from "@/components/clients/client-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/form-message";
import { apiPost } from "@/lib/api.client";
import { initials } from "@/lib/format";

interface ClientsViewProps {
  businessId: string;
  clients: Client[];
  status: "active" | "archived";
  search: string;
}

type Editing = { mode: "create" } | { mode: "edit"; client: Client } | null;

export function ClientsView({ businessId, clients, status, search }: ClientsViewProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [archiving, setArchiving] = useState<Client | null>(null);
  const [archiveError, setArchiveError] = useState("");
  const [pending, setPending] = useState(false);

  const base = `/${businessId}/clients`;
  const href = (next: { status?: string; q?: string }) => {
    const params = new URLSearchParams();
    const nextStatus = next.status ?? status;
    const nextQuery = next.q ?? search;
    if (nextStatus === "archived") params.set("status", "archived");
    if (nextQuery) params.set("q", nextQuery);
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  };

  function onSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    router.replace(href({ q }));
  }

  async function confirmArchive() {
    if (!archiving) return;
    setPending(true);
    setArchiveError("");
    try {
      await apiPost(`/businesses/${businessId}/clients/${archiving.id}/archive`, {});
      setArchiving(null);
      router.refresh();
    } catch {
      setArchiveError("We couldn't archive this client. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3.5">
        <div>
          <p className="text-xs text-sub">Clients / Business contacts</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Your clients.</h1>
          <p className="mt-1.25 text-sm text-sub">Keep their details ready for the next invoice.</p>
        </div>
        <Button type="button" onClick={() => setEditing({ mode: "create" })}>
          <Plus aria-hidden className="size-4" />
          Add client
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <form role="search" method="get" onSubmit={onSearch} className="relative w-full max-w-67.5">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-sub"
          />
          <input
            name="q"
            type="search"
            defaultValue={search}
            aria-label="Search clients"
            placeholder="Search name, company, phone"
            className="w-full rounded-panel border border-line bg-panel py-2.5 pr-2.5 pl-8.5 text-sm"
          />
        </form>
        <nav aria-label="Client status" className="flex gap-1.5">
          {(["active", "archived"] as const).map((value) => (
            <Link
              key={value}
              href={href({ status: value })}
              aria-current={status === value ? "page" : undefined}
              className="rounded-panel border border-line px-3 py-2 text-sm capitalize aria-[current=page]:border-transparent aria-[current=page]:bg-soft aria-[current=page]:text-accent"
            >
              {value === "active" ? "Active" : "Archived"}
            </Link>
          ))}
        </nav>
      </div>

      <section
        aria-label="Clients"
        className="overflow-hidden rounded-panel border border-line bg-panel"
      >
        {clients.length === 0 ? (
          <div className="p-8 text-center text-sm text-sub">
            {search
              ? `No clients match “${search}”.`
              : status === "archived"
                ? "No archived clients."
                : "No clients yet. Add your first client to start invoicing."}
          </div>
        ) : (
          <ul>
            {clients.map((client) => (
              <li
                key={client.id}
                className="grid grid-cols-[minmax(0,1.3fr)_auto] items-center gap-3.75 border-b border-line p-4.75 last:border-b-0 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="grid size-8.75 shrink-0 place-items-center rounded-lg bg-soft text-xs text-accent"
                  >
                    {initials(client.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium wrap-anywhere">{client.name}</p>
                    {client.companyName && client.companyName !== client.name && (
                      <p className="text-xs text-sub">{client.companyName}</p>
                    )}
                  </div>
                </div>
                <div className="hidden min-w-0 text-sm text-sub sm:block">
                  <p>{formatKenyanPhone(client.phone)}</p>
                  {client.email && <p className="truncate">{client.email}</p>}
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setEditing({ mode: "edit", client })}
                  >
                    <Pencil aria-hidden className="size-4" />
                    <span className="sr-only sm:not-sr-only">Edit</span>
                    <span className="sr-only"> {client.name}</span>
                  </Button>
                  {status === "active" && (
                    <Button type="button" variant="ghost" onClick={() => setArchiving(client)}>
                      <Archive aria-hidden className="size-4" />
                      <span className="sr-only sm:not-sr-only">Archive</span>
                      <span className="sr-only"> {client.name}</span>
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.mode === "edit" ? "Edit client" : "Add client"}
      >
        {editing && (
          <ClientForm
            key={editing.mode === "edit" ? editing.client.id : "new"}
            businessId={businessId}
            client={editing.mode === "edit" ? editing.client : undefined}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              router.refresh();
            }}
          />
        )}
      </Dialog>

      <Dialog
        open={archiving !== null}
        onClose={() => setArchiving(null)}
        title="Archive this client?"
        description="They will no longer appear in new invoice selections. Existing invoices are preserved."
      >
        <FormMessage>{archiveError}</FormMessage>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={() => setArchiving(null)}>
            Keep active
          </Button>
          <Button type="button" pending={pending} onClick={confirmArchive}>
            Archive client
          </Button>
        </div>
      </Dialog>
    </>
  );
}
