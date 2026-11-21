"use client";

import { useState } from "react";
import { Calendar, ChevronDown, Plus } from "lucide-react";
import { money as formatMoney } from "@/lib/stock-agent-api";
import {
  AskBar, Card, ClientSwitcher, CplChip, DropdownTrigger, EmptyState, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger,
  PILL_EXTRA, Pill, Radio, RadioGroup, Rail, SECTIONS, SectionHeader, SetupRing, Table, TableBody, TableHead, Td, Th, Tr,
} from "@/components/by";
import { CLIENTS, COUNTS, ROWS, STATUS_LABEL, TABS } from "./sample-data";

const money = (n) => formatMoney(n, "GBP");
const HAS_DATE_RANGE = new Set(["birds-eye", "dashboard"]);

export default function KitShellPage() {
  const [sectionId, setSectionId] = useState("buyer");
  const [tab, setTab] = useState("dashboard");
  const [clientId, setClientId] = useState(null);
  const [listState, setListState] = useState("ready");
  const [note, setNote] = useState("");

  const section = SECTIONS.find((s) => s.id === sectionId) ?? SECTIONS[1];
  const client = CLIENTS.find((c) => c.id === clientId) ?? null;
  const rows = client ? ROWS.filter(([name]) => name === client.name) : ROWS;

  return (
    <div className="grid h-screen grid-cols-[auto_minmax(0,1fr)]">
      <Rail
        activeId={sectionId}
        onSelect={(id) => { if (id !== "settings") setSectionId(id); }}
        counts={COUNTS}
        // A section whose agent isn't set up yet shows a lock.
        locks={{ coach: true }}
        credits={{ left: 4359, percent: 44 }}
        user={{ name: "Hadley" }}
        setup={<SetupRing percent={44} onOpen={() => setNote("Opened the setup checklist")} />}
        switcher={
          <ClientSwitcher
            clients={CLIENTS}
            value={clientId}
            onChange={setClientId}
            status={listState}
            onRetry={() => setListState("ready")}
            onAddClient={(typed) => setNote(typed ? `Add client: “${typed}”` : "Add client")}
          />
        }
      />
      <div className="flex min-w-0 flex-col">
        <SectionHeader
          section={section}
          subtitle={client ? `${client.name} · ${STATUS_LABEL[client.status]}` : undefined}
          tabs={TABS}
          tab={tab}
          onTabChange={setTab}
          more={
            <Menu>
              <MenuTrigger className={PILL_EXTRA}>More<ChevronDown aria-hidden="true" /></MenuTrigger>
              <MenuContent>
                {["Reports", "Projections", "Context"].map((name) => (
                  <MenuItem key={name} onSelect={() => setNote(`Opened ${name}`)}>{name}</MenuItem>
                ))}
                <MenuSeparator />
                <MenuItem onSelect={() => setNote("New dashboard")}><Plus aria-hidden="true" />New dashboard</MenuItem>
              </MenuContent>
            </Menu>
          }
          dateRange={HAS_DATE_RANGE.has(tab) ? (
            <DropdownTrigger leading={<Calendar aria-hidden="true" />}>
              <span className="font-semibold">Last 7 days</span>
              <span className="text-by-body-sm text-by-text-2">29 Oct – 4 Nov</span>
            </DropdownTrigger>
          ) : null}
        />
        <main className="relative flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-7 pt-5 pb-24">
          <p className="text-by-body-sm text-by-text-2">
            {client ? `Last 7 days · ${client.name}` : "Last 7 days · 33 clients · most urgent first"}
          </p>
          <Card className="overflow-hidden">
            {rows.length ? (
              <Table>
                <TableHead>
                  <tr><Th>Client</Th><Th numeric>Leads</Th><Th numeric>CPL</Th><Th numeric>Ad spend</Th><Th>Birdy</Th></tr>
                </TableHead>
                <TableBody>
                  {rows.map(([name, leads, tone, cpl, spend, birdy]) => (
                    <Tr key={name} interactive>
                      <Td className="font-semibold">{name}</Td>
                      <Td numeric>{leads}</Td>
                      <Td numeric><CplChip tone={tone}>{money(cpl)}</CplChip></Td>
                      <Td numeric>{money(spend)}</Td>
                      <Td><Pill tone={birdy[0]}>{birdy[1]}</Pill></Td>
                    </Tr>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title={`Nothing to show for ${client.name}`}>This sample has no dashboard rows for this client.</EmptyState>
            )}
          </Card>

          <Card padded className="max-w-[560px]">
            <h2 className="text-by-body-sm font-semibold text-by-text-2">Preview controls</h2>
            <p className="mt-1 text-by-body-sm text-by-muted">Set the client list’s state, then open the switcher (the dark tile, or ⌘K).</p>
            <RadioGroup className="mt-3" value={listState} onValueChange={setListState} aria-label="Client list state">
              <Radio value="ready" label="Loaded" />
              <Radio value="loading" label="Loading" />
              <Radio value="error" label="Failed" />
            </RadioGroup>
            <p className="mt-3 text-by-caption text-by-muted" aria-live="polite">{note}</p>
          </Card>

          <AskBar
            className="fixed bottom-4 left-[calc(50%+2.125rem)] w-[min(47.5rem,calc(100%-8rem))] -translate-x-1/2"
            placeholder={`Ask ${section.name} about your clients, or tell it what to change`}
            onSubmit={(text) => setNote(`Asked: “${text}”`)}
          />
        </main>
      </div>
    </div>
  );
}
