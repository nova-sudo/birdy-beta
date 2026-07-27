# Tool contract: `get_media_buying_playbook`

A single Birdy tool that serves one skill module on demand, so the base system prompt stays small and
the agent pulls depth (full playbooks, per-source metric tables, report templates) only when a task
needs it. This is the skill's Capability Registry, re-expressed as a tool.

**Source of truth:** the returned content **is** this skill's files. Ship `references/**` with the
backend and read the requested file — do not paste module text into backend code, or it will drift
from the skill.

## Definition (provider-agnostic)

```json
{
  "name": "get_media_buying_playbook",
  "description": "Load a media-buying reference module (analysis method, output template, per-source metric detail, or the extension/derived-metrics notes) when you need the full method or format. Call this before writing an audit, client report, or lead-quality analysis, or when you need the precise definition of a metric or the deep steps of an analysis.",
  "input_schema": {
    "type": "object",
    "properties": {
      "module": {
        "type": "string",
        "description": "Which module to load.",
        "enum": [
          "metrics-glossary",
          "sources/meta", "sources/gohighlevel", "sources/hotprospector",
          "playbooks/account-triage", "playbooks/isolating-cause", "playbooks/fatigue",
          "playbooks/lead-quality", "playbooks/scaling", "playbooks/budget-reallocation",
          "templates/optimization-audit", "templates/client-report",
          "templates/adhoc-qa", "templates/lead-quality"
        ]
      }
    },
    "required": ["module"]
  }
}
```

## Handler (pseudo-code)

```js
// SKILL_REFS points at this skill's references/ directory, shipped with the backend.
function get_media_buying_playbook({ module }) {
  const safe = module.replace(/[^a-z0-9/_-]/gi, "");          // no traversal
  const path = `${SKILL_REFS}/${safe}.md`;
  if (!path.startsWith(SKILL_REFS)) throw new Error("bad module");
  return readFileSync(path, "utf8");
}
```

## When the agent should call it

- Before producing a deliverable → load the matching `templates/*` module and follow it.
- When an analysis needs the full method (e.g. diagnosing fatigue, judging lead quality, planning a
  scale) → load the matching `playbooks/*` module.
- When it needs a metric's exact meaning or a source's fields/endpoints → `metrics-glossary` or the
  matching `sources/*` module.

The base system prompt already carries the summarized framework, so most quick answers need no tool
call — reserve it for depth and for consistent report formatting.

## Keeping the enum in sync

The `enum` mirrors the skill's registry. When you add a module to the skill (see
`references/_extending.md`), add its id here too. `scripts/validate_skill.py` keeps the skill side
honest; this enum is the one place the backend must track.
