"use client"

import * as React from "react"
import { InboxIcon, MoreHorizontalIcon, SearchIcon } from "lucide-react"

import {
  BarList,
  Badge,
  BirdyRead,
  Breakdown,
  Button,
  Checkbox,
  ConfirmHost,
  DataTable,
  DataTableColumnHeader,
  Delta,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  Frame,
  FrameAction,
  Input,
  Kbd,
  Label,
  MetricCard,
  MetricGroup,
  MetricTabsChart,
  MoneyCell,
  Notice,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SegmentedTabs,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Skeleton,
  Spinner,
  StateBadge,
  StatusCell,
  Surface,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TwoLineCell,
  confirm,
  toast,
} from "@/components/ds"

const gbp = (n) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const METRICS = [
  { key: "leads", label: "Leads", value: "1,284", delta: { change: 12.4, comparison: "vs last week" }, series: [150, 168, 190, 176, 214, 198, 188], prev: [140, 150, 162, 170, 168, 160, 155] },
  { key: "calls", label: "Booked calls", value: "212", delta: { change: 17, comparison: "vs last week" }, series: [24, 28, 35, 30, 41, 28, 26], prev: [20, 22, 28, 27, 30, 24, 22] },
  { key: "cpl", label: "Cost per lead", value: "£18.40", delta: { change: -6.1, comparison: "vs last week" }, goodWhen: "down", series: [20.1, 19.4, 18.9, 18.2, 17.8, 18.6, 18.4], prev: [21, 20.6, 20.2, 19.8, 19.4, 19.9, 19.6] },
  { key: "spend", label: "Ad spend", value: "£23,620", caption: "of £30,000 budget", series: [3100, 3400, 3600, 3300, 3700, 3300, 3220], prev: [3000, 3100, 3200, 3300, 3350, 3250, 3100] },
]

const CLIENTS = [
  { id: "1", client: "Harbour Dental", manager: "Priya Shah", status: "success", statusLabel: "On target", leads: 412, spend: 6120, cpl: 14.85 },
  { id: "2", client: "Kestrel Roofing", manager: "Tom Ellis", status: "warning", statusLabel: "Leads waiting", leads: 298, spend: 5480, cpl: 18.39 },
  { id: "3", client: "Oakline Solar", manager: "Priya Shah", status: "danger", statusLabel: "Over CPL target", leads: 201, spend: 6251, cpl: 31.1 },
  { id: "4", client: "Brightside Legal", manager: "Amara Okafor", status: "success", statusLabel: "On target", leads: 187, spend: 3540, cpl: 18.93 },
  { id: "5", client: "Fernhill Physio", manager: "Tom Ellis", status: "neutral", statusLabel: "Paused", leads: 0, spend: 0, cpl: 0 },
]

const COLUMNS = [
  {
    accessorKey: "client",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Client" />,
    meta: { label: "Client" },
    cell: ({ row }) => <TwoLineCell primary={row.original.client} secondary={row.original.manager} />,
  },
  {
    accessorKey: "status",
    header: "Status",
    meta: { label: "Status", variant: "select", options: [{ label: "On target", value: "success" }, { label: "Leads waiting", value: "warning" }, { label: "Over CPL target", value: "danger" }, { label: "Paused", value: "neutral" }] },
    cell: ({ row }) => <StatusCell tone={row.original.status} label={row.original.statusLabel} />,
  },
  {
    accessorKey: "leads",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Leads" />,
    meta: { label: "Leads" },
    cell: ({ row }) => <span className="num text-sm">{row.original.leads.toLocaleString("en-GB")}</span>,
  },
  {
    accessorKey: "spend",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Spend" />,
    meta: { label: "Spend" },
    cell: ({ row }) => <MoneyCell value={row.original.spend} sub={row.original.cpl ? `${gbp(row.original.cpl)} per lead` : undefined} />,
  },
]

const FINDINGS = [
  { id: "oakline", tone: "danger", title: "Oakline Solar CPL up 22%", detail: "£31.10 against a £25 target since Tuesday", action: { label: "Review", onClick: () => toast("Opening Oakline Solar") } },
  { id: "kestrel", tone: "warning", title: "18 leads waiting over 1 hour", detail: "Kestrel Roofing, oldest 3h 12m", action: { label: "Assign", onClick: () => toast("Assigning 18 leads") } },
  { id: "harbour", tone: "success", title: "Harbour Dental beat its record", detail: "412 leads, best week since March", action: { label: "Share", href: "/clients" } },
]

const SWATCHES = [
  ["background", "bg-background"], ["frame", "bg-frame"], ["muted", "bg-muted"], ["foreground", "bg-foreground"], ["primary", "bg-primary"],
  ["primary-soft", "bg-primary-soft"], ["success", "bg-success"], ["warning", "bg-warning"], ["danger", "bg-danger"], ["info", "bg-info"],
  ["chart-1", "bg-chart-1"], ["chart-2", "bg-chart-2"], ["chart-3", "bg-chart-3"], ["chart-4", "bg-chart-4"],
]
const TYPE = [
  ["text-xs", "text-xs", "13 · Captions and meta"], ["text-sm", "text-sm", "14 · Body and controls"], ["text-base", "text-base", "16 · Section titles"],
  ["text-lg", "text-lg", "18 · Card sub-figures"], ["text-xl", "text-xl", "20 · Page section headings"], ["text-figure", "text-figure", "28 · Metric figures"],
  ["text-2xl", "text-2xl", "24 · Card titles and hero figures"],
]
const RADII = [["control", "rounded-control"], ["surface", "rounded-surface"], ["frame", "rounded-frame"], ["overlay", "rounded-overlay"]]
const SHADOWS = [["control", "shadow-control"], ["surface", "shadow-surface"], ["floating", "shadow-floating"], ["overlay", "shadow-overlay"]]

function Section({ id, title, children }) {
  return (
    <section id={id} className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-xs text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

export default function Showcase() {
  const [metric, setMetric] = React.useState("leads")
  const [segment, setSegment] = React.useState("7d")
  const [loading, setLoading] = React.useState(false)

  const metrics = METRICS.map(({ series, prev, ...m }) => ({
    ...m,
    series: series.map((current, i) => ({ x: DAYS[i], current, previous: prev[i] })),
  }))
  const formatValue = (n, m) => (m?.key === "cpl" || m?.key === "spend" ? gbp(n) : n.toLocaleString("en-GB"))

  const askConfirm = async () => {
    const ok = await confirm({ title: "Pause Oakline Solar?", description: "Its three Meta campaigns stop spending until you resume them.", confirmLabel: "Pause campaigns" })
    toast(ok ? "Oakline Solar paused" : "Left running")
  }

  return (
    <div data-ds="showcase" className="mx-auto flex w-full max-w-5xl flex-col gap-12 pb-16">
      <ConfirmHost />
      <header className="flex flex-col gap-1">
        <h1 className="text-title-sm font-semibold tracking-[-0.02em] text-foreground md:text-title">Birdy design system</h1>
        <p className="text-sm text-muted-foreground">The ds kit in one place. Dev only, returns 404 in production.</p>
      </header>

      <Section id="foundations" title="Foundations">
        <Row label="Colour">
          {SWATCHES.map(([name, cls]) => (
            <div key={name} className="flex w-24 flex-col gap-1.5">
              <span className={`h-12 rounded-control shadow-control ${cls}`} />
              <span className="font-mono text-xs text-muted-foreground">{name}</span>
            </div>
          ))}
        </Row>
        <Row label="Type · Outfit">
          <div className="flex w-full flex-col gap-2">
            {TYPE.map(([name, cls, note]) => (
              <div key={name} className="flex items-baseline gap-4">
                <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">{name}</span>
                <span className={`${cls} text-foreground`}>{note}</span>
              </div>
            ))}
            <div className="flex items-baseline gap-4">
              <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">num</span>
              <span className="num text-lg font-medium text-foreground">£23,620 · 1,284 · 18.4%</span>
            </div>
            <div className="flex items-baseline gap-4">
              <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">mono</span>
              <span className="font-mono text-sm text-foreground">Mon 12 Oct – Sun 18 Oct</span>
            </div>
          </div>
        </Row>
        <Row label="Radius">
          {RADII.map(([name, cls]) => (
            <div key={name} className="flex flex-col gap-1.5">
              <span className={`size-20 border border-border bg-background ${cls}`} />
              <span className="font-mono text-xs text-muted-foreground">{name}</span>
            </div>
          ))}
        </Row>
        <Row label="Shadow">
          <div className="flex gap-6 rounded-frame bg-frame p-6">
            {SHADOWS.map(([name, cls]) => (
              <div key={name} className="flex flex-col gap-1.5">
                <span className={`size-20 rounded-surface bg-background ${cls}`} />
                <span className="font-mono text-xs text-muted-foreground">{name}</span>
              </div>
            ))}
          </div>
        </Row>
      </Section>

      <Section id="primitives" title="Primitives">
        <Row label="Button · variants">
          <Button variant="primary">Primary</Button>
          <Button>Outline</Button>
          <Button variant="dashed">Dashed</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
        </Row>
        <Row label="Button · sizes">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button size="icon-sm" aria-label="Search"><SearchIcon /></Button>
          <Button size="icon" aria-label="More"><MoreHorizontalIcon /></Button>
        </Row>
        <Row label="Badge">
          {["neutral", "primary", "success", "warning", "danger", "info", "purple", "muted"].map((t) => (
            <Badge key={t} tone={t}>{t}</Badge>
          ))}
          {["success", "warning", "danger"].map((t) => (
            <Badge key={t} tone={t} variant="dot">{t}</Badge>
          ))}
          <Badge size="sm" tone="info">small</Badge>
        </Row>
        <Row label="StateBadge">
          {["live", "paused", "pending", "failed", "draft", "churned", "demo", "onboarding"].map((s) => (
            <StateBadge key={s} state={s} />
          ))}
        </Row>
        <Row label="Fields">
          <div className="flex w-64 flex-col gap-1.5">
            <Label htmlFor="ds-client">Client name</Label>
            <Input id="ds-client" placeholder="Harbour Dental" />
          </div>
          <div className="flex w-64 flex-col gap-1.5">
            <Label>Account manager</Label>
            <Select defaultValue="priya">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="priya">Priya Shah</SelectItem>
                <SelectItem value="tom">Tom Ellis</SelectItem>
                <SelectItem value="amara">Amara Okafor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-64 flex-col gap-1.5">
            <Label htmlFor="ds-note">Note</Label>
            <Textarea id="ds-note" placeholder="Anything the team should know" />
          </div>
        </Row>
        <Row label="Checkbox, switch, kbd">
          <label className="flex items-center gap-2 text-sm"><Checkbox defaultChecked /> Email me weekly</label>
          <label className="flex items-center gap-2 text-sm"><Switch defaultChecked /> Auto-assign leads</label>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">Search <Kbd>⌘</Kbd><Kbd>K</Kbd></span>
        </Row>
        <Row label="Tabs">
          <Tabs defaultValue="overview" className="w-full max-w-md">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="campaigns" count={3}>Campaigns</TabsTrigger>
              <TabsTrigger value="leads" count={412} attention>Leads</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="text-sm text-muted-foreground">Harbour Dental at a glance.</TabsContent>
            <TabsContent value="campaigns" className="text-sm text-muted-foreground">Three live campaigns.</TabsContent>
            <TabsContent value="leads" className="text-sm text-muted-foreground">412 leads this week.</TabsContent>
          </Tabs>
          <Tabs defaultValue="overview">
            <TabsList variant="underline" size="sm">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs defaultValue="all">
            <TabsList variant="chips">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="open" count={8}>Open</TabsTrigger>
              <TabsTrigger value="unset" warning>No location</TabsTrigger>
            </TabsList>
          </Tabs>
          <SegmentedTabs
            value={segment}
            onValueChange={setSegment}
            ariaLabel="Date range"
            items={[{ value: "today", label: "Today" }, { value: "7d", label: "7 days" }, { value: "30d", label: "30 days" }]}
          />
        </Row>
      </Section>

      <Section id="surfaces" title="Surfaces">
        <Frame
          title="Frame"
          description="A muted frame around one flush white surface"
          action={<FrameAction href="#surfaces">View all</FrameAction>}
          footer={<span>The footer strip, in the frame&apos;s muted tone</span>}
          padded
        >
          The frame&apos;s own surface. Content sits here directly, not in a nested Surface.
        </Frame>
        <Surface>A free-standing Surface, for a panel with no frame.</Surface>
        <Notice tone="warning" title="Meta token expires in 3 days" action={<Button size="sm">Reconnect</Button>}>
          Kestrel Roofing campaigns stop syncing when it lapses.
        </Notice>
        <div className="grid gap-3 md:grid-cols-2">
          <Surface>
            <EmptyState icon={InboxIcon} title="No leads yet" description="New leads from Harbour Dental will land here." action={<Button size="sm">Connect a source</Button>} />
          </Surface>
          <Surface className="flex flex-col gap-4">
            <ErrorState title="Couldn't load campaigns" onRetry={() => toast("Retrying")} />
            <div className="flex items-center gap-3">
              <Spinner />
              <Skeleton className="h-4 w-40" />
            </div>
          </Surface>
        </div>
      </Section>

      <Section id="overlays" title="Overlays">
        <div className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger asChild><Button>Dialog</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a client</DialogTitle>
                <DialogDescription>Connect their ad accounts after you save.</DialogDescription>
              </DialogHeader>
              <Input placeholder="Brightside Legal" />
              <DialogFooter><Button variant="primary">Save client</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger asChild><Button>Sheet</Button></SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Oakline Solar</SheetTitle>
                <SheetDescription>CPL £31.10 against a £25 target.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
          <Popover>
            <PopoverTrigger asChild><Button>Popover</Button></PopoverTrigger>
            <PopoverContent className="p-4 text-sm">Spend is pacing to £28,400 of £30,000.</PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button>Dropdown</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Kestrel Roofing</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Open</DropdownMenuItem>
              <DropdownMenuItem>Assign leads</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild><Button>Tooltip</Button></TooltipTrigger>
            <TooltipContent>Cost per lead, last 7 days</TooltipContent>
          </Tooltip>
          <Button onClick={askConfirm}>Confirm</Button>
          <Button onClick={() => toast("Report sent to Harbour Dental")}>Toast</Button>
        </div>
      </Section>

      <Section id="data" title="Data">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Delta change={12.4} comparison="vs last week" /> <Delta change={-4} />{" "}
          <Delta change={-6.1} goodWhen="down" /> <Delta change={6} format="count" /> <Delta change={null} />{" "}
          <Delta change={3.2} variant="badge" />
        </div>
        <MetricTabsChart
          metrics={metrics}
          value={metric}
          onValueChange={setMetric}
          formatValue={formatValue}
          xLabel="Day"
          loading={loading}
        />
        <Button className="self-start" size="sm" onClick={() => setLoading((v) => !v)}>
          {loading ? "Show data" : "Show loading"}
        </Button>
        <MetricGroup
          title="This week"
          items={[
            {
              key: "leads",
              label: "Leads",
              value: 1284,
              format: "number",
              description: "Every lead the ad accounts reported in the window.",
              delta: { change: 12.4, comparison: "vs last week" },
              caption: "Meta and CRM",
            },
            {
              key: "cpl",
              label: "Cost per lead",
              value: "£18.40",
              delta: { change: -6.1, comparison: "vs last week" },
              goodWhen: "down",
            },
            { key: "booked", label: "Booked calls", value: 212, ratio: { total: 240 }, delta: { change: 31, format: "count", comparison: "vs last week" } },
            { key: "spend", label: "Ad spend", value: "£23,620", caption: "of £30,000 budget" },
          ]}
        />
        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard label="Booked calls" value="212" delta={{ change: 17, comparison: "vs last week" }} caption="31 more than last week" />
          <Breakdown
            title="Leads by client"
            total="1,284"
            rows={[
              { key: "h", label: "Harbour Dental", color: "var(--color-chart-1)", delta: { change: 18 }, value: "412", share: 32 },
              { key: "k", label: "Kestrel Roofing", color: "var(--color-chart-2)", delta: { change: 9 }, value: "298", share: 23 },
              { key: "o", label: "Oakline Solar", color: "var(--color-chart-3)", delta: { change: -4 }, value: "201", share: 16 },
              { key: "b", label: "Brightside Legal", color: "var(--color-chart-4)", delta: { change: 2 }, value: "187", share: 15 },
            ]}
          />
          <BarList
            title="Spend by client"
            rows={[
              { key: "o", label: "Oakline Solar", value: 6251, display: gbp(6251) },
              { key: "h", label: "Harbour Dental", value: 6120, display: gbp(6120) },
              { key: "k", label: "Kestrel Roofing", value: 5480, display: gbp(5480) },
              { key: "b", label: "Brightside Legal", value: 3540, display: gbp(3540) },
            ]}
          />
        </div>
        {/* The table draws its own frame. */}
        <DataTable columns={COLUMNS} data={CLIENTS} getRowId={(r) => r.id} pageSize={10} />
        <Frame title="Lifecycle changes" description="The same table set inside a Frame draws no frame of its own.">
          <DataTable columns={COLUMNS} data={CLIENTS.slice(0, 3)} getRowId={(r) => r.id} pageSize={10} />
        </Frame>
      </Section>

      <Section id="birdy-read" title="Birdy's read">
        <div className="grid gap-4 md:grid-cols-2">
          <BirdyRead findings={FINDINGS} prompt="What changed across my clients this week?" />
          <BirdyRead findings={[]} />
        </div>
      </Section>
    </div>
  )
}
