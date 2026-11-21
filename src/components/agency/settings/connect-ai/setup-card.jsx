"use client";

// Birdy's MCP link, the setup steps for the app picked, and the optional
// daily check-in prompt.

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button, Card, Pill, TabPill } from "@/components/by";
import { CHECK_IN_PROMPT, CONNECT_APPS, stepParts } from "@/lib/connect-ai";
import { copyText } from "./copy";

/**
 * @param {string} props.mcpUrl
 * @param {number|null} props.connected how many apps are connected; null while loading
 */
export function SetupCard({ mcpUrl, connected }) {
  const [appKey, setAppKey] = useState(CONNECT_APPS[0].key);
  const app = CONNECT_APPS.find((a) => a.key === appKey);
  return (
    <Card className="flex min-w-0 flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-by-lg bg-by-accent-soft text-by-accent [&_svg]:size-5"><Sparkles /></span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">Add Birdy to your AI assistant</h3>
            {connected > 0 && <Pill tone="success">{connected} connected</Pill>}
          </div>
          <p className="text-by-body-sm text-by-muted">Ask about your clients, get alerts explained, and run your media buying agent from Claude, ChatGPT or Cursor.</p>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2 rounded-by-md border border-by-line bg-by-canvas py-1.5 pr-1.5 pl-3">
        <code className="min-w-0 flex-1 truncate font-mono text-by-body-sm font-medium">{mcpUrl}</code>
        <Button size="sm" kind="primary" onClick={() => copyText(mcpUrl, "Link copied")}>Copy link</Button>
      </div>

      <div className="max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TabPill items={CONNECT_APPS.map((a) => ({ value: a.key, label: a.label }))} value={appKey} onValueChange={setAppKey} aria-label="AI app" />
      </div>

      <ol className="flex flex-col gap-1">
        {app.steps.map((s, i) => (
          <li key={i} className="flex gap-3 py-1.5 text-by-body text-by-text-2">
            <span aria-hidden="true" className="grid size-5.5 flex-none place-items-center rounded-full bg-by-accent-soft text-by-caption font-semibold text-by-accent">{i + 1}</span>
            <span className="min-w-0">
              {stepParts(s.text, mcpUrl).map((p, k) => (p.bold ? <b key={k} className="font-semibold text-by-text">{p.text}</b> : <span key={k}>{p.text}</span>))}
              {s.code && (
                <code className="mt-2 block overflow-x-auto rounded-by-md border border-by-line bg-by-canvas px-3 py-2 font-mono text-by-body-sm text-by-text">{s.code.replace("{url}", mcpUrl)}</code>
              )}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-auto border-t border-by-line-soft pt-3.5">
        <h4 className="font-semibold">Daily check-in <span className="font-normal text-by-muted">(optional)</span></h4>
        <p className="mt-0.5 text-by-body-sm text-by-muted">In Claude, create a scheduled task with this prompt to get a morning summary of what needs your attention.</p>
        <div className="mt-2 flex items-start gap-2">
          <p className="min-w-0 flex-1 rounded-by-md border border-dashed border-by-line-strong bg-by-canvas px-3 py-2 text-by-body-sm text-by-text-2">{CHECK_IN_PROMPT}</p>
          <Button size="sm" onClick={() => copyText(CHECK_IN_PROMPT, "Prompt copied")}>Copy</Button>
        </div>
      </div>
    </Card>
  );
}
