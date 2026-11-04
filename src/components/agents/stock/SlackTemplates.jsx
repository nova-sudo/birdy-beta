"use client"

import { useState } from "react"
import { RotateCcw } from "lucide-react"

import { Badge, Button, Frame, Notice, confirm } from "@/components/ds"
import ReportEditor from "@/components/report-designer/ReportEditor"
import { useSlackTemplate } from "@/lib/stock-agent-api"

const TEMPLATES = [
  { kind: "card", name: "Card", help: "One message per client. Birdy adds the Apply, Edit and Dismiss buttons under it." },
  { kind: "summary", name: "Daily summary", help: "The message that opens a report, with the client table. Birdy adds Apply all and Open report." },
  { kind: "weekly", name: "Weekly message", help: "The wrap-up of the week." },
]

function TemplateRow({ agentId, template, onEdit }) {
  const { template: view, error, mutate } = useSlackTemplate(agentId, template.kind)
  return (
    <div className="flex flex-col gap-2 border-b px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 basis-64">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            {template.name}
            {view?.customised && <Badge tone="info" size="sm">Edited</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">{template.help}</p>
        </div>
        {error ? (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            Couldn&apos;t load this template.
            <Button size="sm" variant="ghost" onClick={() => mutate()}>Retry</Button>
          </span>
        ) : (
          <Button size="sm" aria-label={`Edit ${template.name}`} disabled={!view} onClick={() => onEdit(view)}>
            Edit
          </Button>
        )}
      </div>
      {view?.notice && (
        <Notice tone="warning" title={`The ${template.name.toLowerCase()} template couldn't be used`}>
          Birdy posted the default one instead. {view.notice} Save the template again, or reset it, to clear this.
        </Notice>
      )}
    </div>
  )
}

/** One template in the Slack report editor. Reset brings the default back into the editor. */
function TemplateEditor({ template, initial, actions, onClose, onSaved }) {
  const [view, setView] = useState(initial)
  const [version, setVersion] = useState(0)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [problems, setProblems] = useState([])

  const save = async (draft) => {
    setSaving(true)
    setProblems([])
    try {
      await actions.saveSlackTemplate(template.kind, draft.blocks)
      onSaved()
    } catch (err) {
      setProblems(err?.errors?.length ? err.errors.map(String) : [err?.message || "Couldn't save this template. Try again."])
    } finally {
      setSaving(false)
    }
  }

  const reset = async () => {
    const yes = await confirm({
      title: "Reset to the default template?",
      description: `Your changes to the ${template.name.toLowerCase()} template are removed. You can't undo this.`,
      confirmLabel: "Reset template",
    })
    if (!yes) return
    setResetting(true)
    setProblems([])
    try {
      setView(await actions.resetSlackTemplate(template.kind))
      setVersion((v) => v + 1)
    } catch (err) {
      setProblems([err?.message || "Couldn't reset this template. Try again."])
    } finally {
      setResetting(false)
    }
  }

  return (
    <Frame
      title={template.name}
      description="Edit the Slack message. Birdy's own buttons are added after it and can't be removed."
      action={
        view.customised ? (
          <Button size="sm" variant="ghost" loading={resetting} onClick={reset}>
            <RotateCcw aria-hidden />
            Reset to default
          </Button>
        ) : undefined
      }
      padded
      contentClassName="flex flex-col gap-3"
    >
      {problems.length > 0 && (
        <Notice tone="danger" title="Couldn't save this template">
          <ul className="list-disc pl-4">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Notice>
      )}
      <ReportEditor
        key={version}
        brief={{ blocks: view.template?.blocks ?? [] }}
        previewFn={(draft) => actions.previewSlackTemplate(template.kind, draft.blocks)}
        placeholders={view.placeholders}
        extraMetricsDisabled
        saveLabel="Save template"
        saving={saving}
        onSave={save}
        onCancel={onClose}
      />
    </Frame>
  )
}

/**
 * The card, summary and weekly message as editable Slack templates. A saved template that failed at send
 * time shows the server's notice on its row.
 */
export function SlackTemplates({ agentId, actions }) {
  const [editing, setEditing] = useState(null)
  const [saved, setSaved] = useState(null)

  if (editing) {
    return (
      <TemplateEditor
        template={editing.template}
        initial={editing.view}
        actions={actions}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setSaved(editing.template.name)
          setEditing(null)
        }}
      />
    )
  }
  return (
    <Frame title="Slack messages" description="Change how each message looks in Slack. Every template can go back to the default.">
      {TEMPLATES.map((template) => (
        <TemplateRow
          key={template.kind}
          agentId={agentId}
          template={template}
          onEdit={(view) => {
            setSaved(null)
            setEditing({ template, view })
          }}
        />
      ))}
      {saved && (
        <p role="status" className="px-4 py-2 text-xs text-muted-foreground">
          Saved the {saved.toLowerCase()} template.
        </p>
      )}
    </Frame>
  )
}
