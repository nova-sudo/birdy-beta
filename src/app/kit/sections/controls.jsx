"use client";

import { useState } from "react";
import { Calendar, Columns3, Plus, Search, Trash2, Zap } from "lucide-react";
import { AskBar, Button, Checkbox, DropdownTrigger, Radio, RadioGroup, NativeSelectField, SearchField, SelectField, Switch, TextField } from "@/components/by";
import { Row, Section, Sub } from "../kit-parts";
import { SegmentedDemo } from "./segmented-demo";

const KINDS = ["primary", "secondary", "soft", "ghost", "danger"];

export function ControlsSection() {
  const [asked, setAsked] = useState("");
  const [currency, setCurrency] = useState("GBP");
  return (
    <Section title="Actions and inputs">
      <Sub title="Button kinds">
        {KINDS.map((kind) => (
          <Row key={kind} label={kind}>
            <Button kind={kind}>Rest</Button>
            <Button kind={kind}><Zap aria-hidden="true" />With icon</Button>
            <Button kind={kind} loading>Working</Button>
            <Button kind={kind} disabled>Off</Button>
          </Row>
        ))}
        <p className="mt-1 text-by-caption text-by-muted">Hover, press and tab to a button to see those states.</p>
      </Sub>

      <Sub title="Sizes and icon buttons">
        <Row label="sizes">
          <Button kind="primary" size="sm">Small 32</Button>
          <Button kind="primary">Medium 36</Button>
          <Button kind="primary" size="lg">Large 40</Button>
        </Row>
        <Row label="in use">
          <Button kind="primary"><Zap aria-hidden="true" />Do it for me</Button>
          <Button>Dismiss</Button>
          <Button><Plus aria-hidden="true" />Add client</Button>
          <Button kind="danger"><Trash2 aria-hidden="true" />Remove client</Button>
        </Row>
        <Row label="icon only">
          <Button iconOnly aria-label="Columns"><Columns3 aria-hidden="true" /></Button>
          <Button iconOnly kind="ghost" aria-label="Search"><Search aria-hidden="true" /></Button>
          <Button iconOnly kind="danger" aria-label="Delete"><Trash2 aria-hidden="true" /></Button>
          <Button iconOnly kind="primary" loading aria-label="Saving" />
        </Row>
      </Sub>

      <Sub title="Fields">
        <div className="grid max-w-[720px] grid-cols-2 gap-x-4 gap-y-4">
          <TextField label="Client name" defaultValue="Beauty Hub MCR" />
          <TextField label="CPL limit" defaultValue="£6.00" help="Birdy flags ads above this." />
          <SearchField placeholder="Search clients" />
          <DropdownTrigger leading={<Calendar aria-hidden="true" />}>
            <span className="font-semibold">Last 7 days</span>
            <span className="text-by-body-sm text-by-text-2">29 Oct – 4 Nov</span>
          </DropdownTrigger>
          <TextField className="col-span-2" label="Slack channel" defaultValue="media buyers" error="Channel names can’t contain spaces. Try media-buyers." />
          <TextField label="Notes" placeholder="Disabled" disabled />
          <NativeSelectField label="Timezone" defaultValue="Europe/London" options={[{ value: "Europe/London", label: "Europe/London" }, { value: "Asia/Dubai", label: "Asia/Dubai" }, { value: "America/New_York", label: "America/New_York" }]} help="A short list, in the browser's own picker." />
          <SelectField label="Currency" value={currency} onValueChange={setCurrency} options={[{ value: "GBP", label: "GBP (£)" }, { value: "USD", label: "USD ($)" }, { value: "EUR", label: "EUR (€)" }]} help="A select: the field look, a menu of choices." />
        </div>
      </Sub>

      <Sub title="Ask bar">
        <AskBar className="max-w-[720px]" placeholder="Ask Media Buyer about your clients, or tell it what to change" onSubmit={setAsked} />
        <p className="mt-2 text-by-caption text-by-muted" aria-live="polite">{asked ? `Sent: “${asked}”` : "Type something and press Enter."}</p>
      </Sub>

      <Sub title="Switches, checkboxes, radio buttons">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Switch label="Weekly report" defaultChecked />
            <Switch label="Auto-run" />
            <Switch label="Locked" disabled />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Checkbox label="Spend" defaultChecked />
            <Checkbox label="Leads" />
            <Checkbox label="CPL" defaultChecked disabled />
          </div>
          <RadioGroup defaultValue="one" aria-label="How to add clients">
            <Radio value="one" label="One client" />
            <Radio value="bulk" label="Bulk import" />
            <Radio value="later" label="Later" disabled />
          </RadioGroup>
        </div>
      </Sub>

      <SegmentedDemo />
    </Section>
  );
}
