"use client";

import { AdminErrorState } from "@/components/admin/error-state";

export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  return <AdminErrorState error={error} retry={retry} />;
}
