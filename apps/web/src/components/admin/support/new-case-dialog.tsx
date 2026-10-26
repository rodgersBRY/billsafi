"use client";

import {
  type AdminSupportCaseResult,
  type AdminTenantsPage,
  adminSupportCaseCreateSchema,
  SUPPORT_TITLE_MAX,
  supportCategories,
  supportSeverities,
} from "@billsafi/contracts";
import { LoaderCircle, Plus, Search, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { controlBase, SelectField, TextField } from "@/components/ui/field";
import { apiRequest } from "@/lib/api.client";
import { FormActionDialog } from "../subscription-actions/form-action-dialog";
import { issuesByField } from "../subscription-actions/issues";
import { categoryLabels, severityLabels } from "../status-badge";

interface Account {
  id: string;
  name: string;
  email: string;
}

/** Finds an account with the tenants search, and shows the pick with a way to change it. */
function AccountPicker({
  value,
  onChange,
  error,
}: {
  value: Account | null;
  onChange: (account: Account | null) => void;
  error?: string;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const [results, setResults] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const term = text.trim();

  useEffect(() => {
    if (term.length < 2) return;
    let current = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const page = await apiRequest<AdminTenantsPage>(
          `/admin/tenants?search=${encodeURIComponent(term)}`,
        );
        if (current) {
          setResults(
            page.tenants.slice(0, 6).map((tenant) => ({
              id: tenant.id,
              name: tenant.owner.name,
              email: tenant.owner.email,
            })),
          );
        }
      } catch {
        if (current) setResults([]);
      } finally {
        if (current) setLoading(false);
      }
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [term]);

  if (value) {
    return (
      <div className="mt-4">
        <p className="text-xs text-sub">Account</p>
        <div className="mt-1.5 flex items-center justify-between gap-2 rounded-panel border border-line bg-background px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium break-words">{value.name}</p>
            <p className="text-xs break-all text-sub">{value.email}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="grid size-11 shrink-0 place-items-center rounded-md text-sub hover:bg-soft hover:text-ink md:size-8"
          >
            <X aria-hidden className="size-4" />
            <span className="sr-only">Choose another account</span>
          </button>
        </div>
      </div>
    );
  }

  const shown = term.length < 2 ? [] : results;
  return (
    <div className="mt-4">
      <label htmlFor={id} className="block text-xs text-sub">
        Account
      </label>
      <div className="relative">
        <Search aria-hidden className="absolute top-4 left-3 size-4 text-sub" />
        <input
          id={id}
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Name, email or business"
          aria-invalid={error ? true : undefined}
          className={`mt-1.5 pl-9 ${controlBase}`}
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-red-700 dark:text-red-300">{error}</p>}
      <div aria-live="polite">
        {loading && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-sub">
            <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
            Searching
          </p>
        )}
        {!loading && term.length >= 2 && shown.length === 0 && (
          <p className="mt-2 text-xs text-sub">No accounts found.</p>
        )}
      </div>
      {shown.length > 0 && (
        <ul className="mt-2 divide-y divide-line rounded-panel border border-line">
          {shown.map((account) => (
            <li key={account.id}>
              <button
                type="button"
                onClick={() => onChange(account)}
                className="block min-h-11 w-full px-3 py-2 text-left hover:bg-soft"
              >
                <span className="block text-sm font-medium break-words">{account.name}</span>
                <span className="block text-xs break-all text-sub">{account.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewCaseDialog({
  account: initial,
  selfId,
  onClose,
}: {
  account: Account | null;
  selfId: string;
  onClose: () => void;
}) {
  const [account, setAccount] = useState<Account | null>(initial);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("normal");
  const [mine, setMine] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function buildBody() {
    const body = {
      accountId: account?.id ?? "",
      title,
      category,
      severity,
      assignedTo: mine ? selfId : null,
    };
    const parsed = adminSupportCaseCreateSchema.safeParse({ ...body, reason: "placeholder" });
    const next = parsed.success ? {} : issuesByField(parsed.error.issues);
    setErrors(next);
    return Object.keys(next).length ? null : body;
  }

  return (
    <FormActionDialog<AdminSupportCaseResult>
      title="New case"
      target={{
        name: account?.name ?? "No account chosen",
        detail: account?.email ?? "Search for the account below",
      }}
      path="/admin/support/cases"
      submitLabel="Create case"
      buildBody={buildBody}
      onServerIssues={(issues) => setErrors(issuesByField(issues))}
      preview={
        account
          ? `A ${severityLabels[severity as keyof typeof severityLabels]?.toLowerCase() ?? "normal"} case is opened for ${account.name}${mine ? " and assigned to you" : ""}.`
          : "Choose an account to open the case for."
      }
      successMessage={() => "Case created."}
      onClose={onClose}
    >
      {!initial && <AccountPicker value={account} onChange={setAccount} error={errors.accountId} />}
      <TextField
        label="Title"
        value={title}
        maxLength={SUPPORT_TITLE_MAX}
        onChange={(event) => setTitle(event.target.value)}
        error={errors.title}
      />
      <SelectField
        label="Category"
        value={category}
        onChange={(event) => setCategory(event.target.value)}
        error={errors.category}
      >
        <option value="">Choose a category</option>
        {supportCategories.map((value) => (
          <option key={value} value={value}>
            {categoryLabels[value]}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Severity"
        value={severity}
        onChange={(event) => setSeverity(event.target.value)}
        error={errors.severity}
      >
        {supportSeverities.map((value) => (
          <option key={value} value={value}>
            {severityLabels[value]}
          </option>
        ))}
      </SelectField>
      <label className="mt-4 flex min-h-11 items-center gap-2 text-sm md:min-h-0">
        <input
          type="checkbox"
          checked={mine}
          onChange={(event) => setMine(event.target.checked)}
          className="size-4 accent-teal"
        />
        Assign to me
      </label>
    </FormActionDialog>
  );
}

interface NewCaseButtonProps {
  selfId: string;
  /** The account to open the case for, when the page is already about one. */
  account?: Account;
  variant?: "primary" | "secondary";
}

/** "New case", and its dialog while open. */
export function NewCaseButton({ selfId, account, variant = "primary" }: NewCaseButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        className="min-h-11 md:min-h-0"
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden className="size-4" />
        New case
      </Button>
      {open && (
        <NewCaseDialog account={account ?? null} selfId={selfId} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
