"use client";

import type { AdminWhatsNewEntry } from "@billsafi/contracts";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "../confirm-action-dialog";
import { EntryDialog } from "./entry-dialog";

export function NewEntryButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden className="size-4" />
        New entry
      </Button>
      {open && <EntryDialog onClose={() => setOpen(false)} />}
    </>
  );
}

export function EntryRowActions({ entry }: { entry: AdminWhatsNewEntry }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={() => setEditing(true)}>
        <Pencil aria-hidden className="size-4" />
        Edit
      </Button>
      <Button variant="ghost" onClick={() => setDeleting(true)}>
        <Trash2 aria-hidden className="size-4" />
        Delete
      </Button>
      {editing && <EntryDialog entry={entry} onClose={() => setEditing(false)} />}
      <ConfirmActionDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        action={{
          title: "Delete this entry?",
          target: { name: entry.title, detail: `Status: ${entry.status}` },
          impact: ["Users stop seeing it in the panel.", "This can't be undone."],
          confirmLabel: "Delete entry",
          path: `/admin/whats-new/${entry.id}/delete`,
          successMessage: "Entry deleted.",
          destructive: true,
        }}
      />
    </div>
  );
}
