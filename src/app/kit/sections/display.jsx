"use client";

import { useState } from "react";
import { Inbox, Plus } from "lucide-react";
import { money as formatMoney } from "@/lib/stock-agent-api";
import {
  BirdyAvatar, Button, Card, ClientTile, CountBadge, CplChip, Delta, Disclosure, EmptyState, KpiTile, Menu, MenuContent, MenuItem,
  MenuLabel, MenuSeparator, MenuTrigger, Pill, RowArrow, TabPanel, TabPill, Table, TableBody, TableHead, Td, Th, Tooltip, Tr, UserAvatar,
} from "@/components/by";
import { Section, Sub } from "../kit-parts";

const money = (n) => formatMoney(n, "GBP");
const pounds = (n) => `£${Math.round(n).toLocaleString("en-GB")}`;

const TABS = [
  { value: "chat", label: "Chat" },
  { value: "birds-eye", label: "Bird’s Eye" },
  { value: "dashboard", label: "Dashboard" },
  { value: "suggestions", label: "Suggestions", count: 8 },
];

const ROWS = [
  ["Beauty Hub MCR", "danger", "At risk", "0 of 100 leads reached the CRM", 139.0, "success", 1.39, ["danger", "Ads stopped"]],
  ["Aura", "danger", "At risk", "CPL 2.1× the £6 limit", 49.86, "danger", 12.46, ["accent", "3 changes"]],
  ["Fallon Physique", "warning", "At risk", "1 ad over its usual cost", 85.54, "warning", 5.03, ["accent", "1 change"]],
  ["Cloud Nine Beauty", "warning", "At risk", "2 ads over their usual cost", 112.15, "warning", 5.9, ["neutral", "2 scheduled"]],
  ["Healthy Glow", "success", "On track", "", 254.14, "success", 1.67, null],
  ["Autumn Rose Hair & Beauty", "success", "On track", "", 257.79, "success", 2.28, null],
];

export function DisplaySection() {
  const [tab, setTab] = useState("dashboard");
  const [client, setClient] = useState("All clients");
  return (
    <>
      <Section title="Navigation">
        <Sub title="Tab pill">
          <TabPill items={TABS} value={tab} onValueChange={setTab} aria-label="Marketing Guru views">
            {TABS.map((t) => (
              <TabPanel key={t.value} value={t.value} className="mt-2 text-by-body-sm text-by-text-2">Showing {t.label}.</TabPanel>
            ))}
          </TabPill>
        </Sub>
        <Sub title="Menu and tooltip">
          <div className="flex items-center gap-3">
            <Menu>
              <MenuTrigger asChild><Button>{client}</Button></MenuTrigger>
              <MenuContent>
                <MenuLabel>Switch client</MenuLabel>
                {["All clients", "Beauty Hub MCR", "Fallon Physique", "Healthy Glow"].map((name) => (
                  <MenuItem key={name} selected={name === client} onSelect={() => setClient(name)}>{name}</MenuItem>
                ))}
                <MenuSeparator />
                <MenuItem><Plus aria-hidden="true" />Add new client</MenuItem>
              </MenuContent>
            </Menu>
            <Tooltip label="4,359 credits left · 44%"><Button kind="ghost">Hover or focus me</Button></Tooltip>
          </div>
        </Sub>
      </Section>

      <Section title="Data display">
        <Sub title="KPI tiles">
          <div className="grid grid-cols-4 gap-3">
            <KpiTile label="Spend" value={2888} format={pounds} delta={<Delta value={-3.0} />} />
            <KpiTile label="Leads" value={962} delta={<Delta value={-0.9} goodWhen="up" />} />
            <KpiTile label="Avg CPL" value={3} format={money} delta={<Delta value={-2.1} goodWhen="down" />} />
            <KpiTile label="Closed" value={29} delta={<Delta value={-53.2} goodWhen="up" />} />
          </div>
        </Sub>

        <Sub title="Table">
          <Card className="overflow-hidden">
            <Table>
              <TableHead>
                <tr><Th>Client</Th><Th>Status</Th><Th numeric>Spend</Th><Th numeric>CPL</Th><Th>Birdy</Th><Th><span className="sr-only">Open</span></Th></tr>
              </TableHead>
              <TableBody>
                {ROWS.map(([name, tone, status, why, spend, cplTone, cpl, birdy]) => (
                  <Tr key={name} interactive>
                    <Td primary>{name}</Td>
                    <Td><Pill tone={tone}>{status}</Pill>{why && <span className="ml-2 text-by-body-sm text-by-text-2">{why}</span>}</Td>
                    <Td numeric>{money(spend)}</Td>
                    <Td numeric><CplChip tone={cplTone}>{money(cpl)}</CplChip></Td>
                    <Td>{birdy ? <Pill tone={birdy[0]}>{birdy[1]}</Pill> : <span className="text-by-muted">Nothing to do</span>}</Td>
                    <RowArrow />
                  </Tr>
                ))}
              </TableBody>
            </Table>
          </Card>
        </Sub>

        <div className="mt-5 grid grid-cols-3 items-start gap-4">
          <Sub title="Pills and badges">
            <Card padded className="flex flex-wrap gap-2">
              <Pill tone="danger">At risk</Pill>
              <Pill tone="warning">At risk</Pill>
              <Pill tone="success">On track</Pill>
              <Pill tone="danger">Ads stopped</Pill>
              <Pill tone="accent">3 changes</Pill>
              <Pill tone="success">Approved</Pill>
              <Pill tone="accent">Auto-run</Pill>
              <Pill tone="neutral">Inactive</Pill>
              <CplChip tone="success">£1.39</CplChip>
              <CplChip tone="warning">£5.03</CplChip>
              <CplChip tone="danger">£12.46</CplChip>
              <CountBadge>8</CountBadge>
            </Card>
          </Sub>
          <Sub title="Avatars">
            <Card padded className="flex flex-wrap items-center gap-3">
              <BirdyAvatar size={56} />
              <BirdyAvatar size={40} />
              <BirdyAvatar size={32} />
              <BirdyAvatar size={24} />
              <ClientTile name="Beauty Hub MCR" size={40} />
              <ClientTile name="Aura" size={32} />
              <ClientTile name="Fallon Physique" size={24} />
              <UserAvatar name="Hadley" />
            </Card>
          </Sub>
          <Sub title="Empty state">
            <Card>
              <EmptyState icon={<Inbox />} title="No suggestions for Aura" action={<Button kind="primary"><Plus aria-hidden="true" />Ask Marketing Guru</Button>}>
                Marketing Guru checks every client against its limits each morning. New suggestions appear here.
              </EmptyState>
            </Card>
          </Sub>
          <Sub title="Disclosure">
            <Disclosure label="Lead tracking per client" count="3 need setup">
              <p className="text-by-body-sm text-by-text-2">Detail most people skip folds away here until it is wanted.</p>
            </Disclosure>
          </Sub>
        </div>
      </Section>
    </>
  );
}
