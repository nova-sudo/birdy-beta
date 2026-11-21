"use client";

// Settings › Account › Slack report: when Birdy posts its brief to Slack
// (PUT /api/integrations/slack/brief) and what is in it.
//
// The report's contents are shown as the Slack message itself, and changed
// with the report designer's two editors (edit the blocks, or redesign with
// Birdy). Those editors are shared with onboarding and are not part of this
// port: they open, unchanged, inside the kit's dialog.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Dialog, DialogBody, DialogContent, OptionCard, SelectField } from "@/components/by";
import { apiRequest } from "@/lib/api";
import { reportApi, scheduleLabel } from "@/lib/report-designer";
import { BRIEF_TIMES, WEEKDAYS, withCurrent } from "@/lib/account-options";
import SlackMessagePreview from "@/components/report-designer/SlackMessagePreview";
import ReportDesigner from "@/components/report-designer/ReportDesigner";
import ReportEditor from "@/components/report-designer/ReportEditor";

const FREQUENCIES = [
  { key: "daily", title: "Daily", desc: "A summary every morning" },
  { key: "weekly", title: "Weekly", desc: "One digest a week" },
];

/** The schedule: daily or weekly, which day, what time. */
function Schedule({ brief, onSaved }) {
  const [frequency, setFrequency] = useState(brief?.frequency ?? "daily");
  const [time, setTime] = useState(brief?.time ?? "9:00 AM");
  const [day, setDay] = useState(brief?.day ?? "Monday");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!brief) return;
    setFrequency(brief.frequency ?? "daily");
    setTime(brief.time ?? "9:00 AM");
    setDay(brief.day ?? "Monday");
  }, [brief]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiRequest("/api/integrations/slack/brief", {
        method: "PUT",
        body: JSON.stringify({ frequency, time, day: frequency === "weekly" ? day : null }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      onSaved(data.brief);
      toast.success("Brief schedule saved");
    } catch {
      toast.error("Could not save the brief schedule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div role="radiogroup" aria-label="How often" className="grid gap-2.5 sm:grid-cols-2">
        {FREQUENCIES.map((f) => (
          <OptionCard key={f.key} selected={frequency === f.key} title={f.title} subtitle={f.desc} onSelect={() => setFrequency(f.key)} />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 sm:max-w-[30rem]">
        {frequency === "weekly" && <SelectField label="Which day?" value={day} onValueChange={setDay} options={WEEKDAYS.map((d) => ({ value: d, label: d }))} />}
        <SelectField label="What time?" value={time} onValueChange={setTime} options={withCurrent(BRIEF_TIMES, time).map((t) => ({ value: t, label: t }))} />
      </div>
      <div>
        <Button kind="primary" loading={saving} onClick={save}>{saving ? "Saving…" : "Save schedule"}</Button>
      </div>
    </div>
  );
}

/** What is in the report, as Slack will show it, and the two ways to change it. */
function Contents({ brief, onSaved }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(null); // null | "editor" | "copilot"
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPreview(await reportApi.preview(null, "saved"));
    } catch {
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, []);
  // Drawn again whenever the stored report changes (a schedule save, a redesign).
  const version = brief?.updated_at ?? JSON.stringify(brief ?? null);
  useEffect(() => {
    load();
  }, [load, version]);

  const save = useCallback(async (template) => {
    setSaving(true);
    try {
      const { brief: saved } = await reportApi.save(template);
      onSaved(saved);
      setMode(null);
      toast.success("Slack report saved");
    } catch {
      toast.error("Could not save the report");
    } finally {
      setSaving(false);
    }
  }, [onSaved]);

  const template = preview?.template;
  return (
    <div className="flex flex-col gap-3 border-t border-by-line-soft pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h4 className="text-by-body font-semibold">What’s in the report</h4>
          <p className="text-by-caption text-by-muted">{template ? scheduleLabel(template) : "Exactly what Birdy posts to Slack, with your latest numbers."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setMode("editor")}><Pencil aria-hidden="true" />Edit blocks</Button>
          <Button size="sm" onClick={() => setMode("copilot")}><Sparkles aria-hidden="true" />Redesign with Birdy</Button>
        </div>
      </div>
      <div className="max-w-[560px]">
        {!loading && !template ? (
          <p className="rounded-by-lg border border-dashed border-by-line px-4 py-5 text-by-body-sm text-by-muted">No report yet. Design one with Birdy and it will go out on the schedule above.</p>
        ) : (
          <SlackMessagePreview blocks={preview?.blocks} time={template?.time} loading={loading && !!preview} />
        )}
        {preview?.sample && <p className="mt-2 text-by-caption text-by-muted">Sample numbers until your clients have synced.</p>}
      </div>

      <Dialog open={mode !== null} onOpenChange={(o) => !o && !saving && setMode(null)}>
        <DialogContent
          size="xl"
          title={mode === "editor" ? "Edit your Slack report" : "Redesign your Slack report"}
          description={mode === "editor" ? "Build it from any Slack block: charts, tables, cards, buttons. Nothing changes until you press Save report." : "Nothing changes until you press Save report."}
        >
          <DialogBody>
            {mode === "editor" && <ReportEditor brief={template || brief} onSave={save} onCancel={() => setMode(null)} saving={saving} />}
            {mode === "copilot" && <ReportDesigner sessionKey="birdy_settings_report" onUse={save} saving={saving} primaryLabel="Save report" heightClass="lg:h-[min(620px,calc(100dvh-200px))]" />}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * @param {object} props.slack Slack's status; `brief` is the stored report
 * @param {boolean} props.checking the first status request is still out
 * @param {(brief: object) => void} props.onSaved
 */
export function SlackReport({ slack, checking, onSaved }) {
  return (
    <Card padded className="flex flex-col gap-4">
      <div>
        <h3 className="font-by-display text-by-body-lg font-bold">Slack report</h3>
        <p className="text-by-body-sm text-by-muted">When Birdy sends your Slack report, and what’s in it</p>
      </div>
      {!slack.installed ? (
        <p className="text-by-body-sm text-by-text-2">{checking ? "Checking your Slack connection…" : "Connect Slack under Connections to schedule a report."}</p>
      ) : (
        <>
          <Schedule brief={slack.brief} onSaved={onSaved} />
          <Contents brief={slack.brief} onSaved={onSaved} />
          <p className="text-by-body-sm text-by-text-2">
            Want more than one report, a time to the minute, or a report when an alert fires?{" "}
            <Link href="/hub" className="font-semibold text-by-accent underline-offset-2 hover:underline">Manage all reports in BirdyHub</Link>
          </p>
        </>
      )}
    </Card>
  );
}
