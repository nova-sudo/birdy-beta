"use client";

// The card every section table sits in, and what it shows instead of rows.
// Shared by a client's tables and the agency-wide ones on Media Buyer's and Sales Coach's Dashboard.

import { useState } from "react";
import { SearchX } from "lucide-react";
import { Button, Card, ColumnsMenu, EmptyState, Notice, Skeleton, TableScroll } from "@/components/by";

/** The card every client table sits in: a toolbar that stays put, and the table scrolling under it. */
export function TableCard({ toolbar, state, children }) {
  return (
    <Card className="flex min-h-0 flex-col overflow-hidden motion-safe:animate-[by-enter_var(--by-dur-base)_var(--by-ease-out)]">
      <div className="flex shrink-0 flex-wrap items-center gap-2.5 border-b border-by-line px-4.5 py-3.5">{toolbar}</div>
      {state ?? <TableScroll className="rounded-none border-0 shadow-none">{children}</TableScroll>}
    </Card>
  );
}

/** What a table shows instead of rows: loading, a failure, or nothing to list. */
export function tableState({ data, shown, noun, empty, icon }) {
  if (data.error) {
    return <div className="p-4"><Notice tone="danger" action={<Button size="sm" onClick={data.retry}>Retry</Button>}>Couldn’t load {noun}. Check your connection and try again.</Notice></div>;
  }
  if (data.loading) {
    return (
      <div aria-busy="true" aria-label={`Loading ${noun}`} className="flex flex-col gap-4 p-5">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="w-full" />)}
      </div>
    );
  }
  if (data.rows.length === 0) return <EmptyState icon={icon} title={empty.title}>{empty.body}</EmptyState>;
  if (shown === 0) return <EmptyState icon={<SearchX />} title={`No ${noun} match`}>Try a different search or tab.</EmptyState>;
  return null;
}

/** Which of a table's optional columns are shown, with the menu that changes them. */
export function useColumns(all) {
  const [ids, setIds] = useState(() => all.map((c) => c.id));
  const menu = <ColumnsMenu columns={all} value={ids} onChange={setIds} />;
  return { shows: (id) => ids.includes(id), menu };
}

export const money = (symbol) => (n, decimals = 0) => `${symbol}${Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
