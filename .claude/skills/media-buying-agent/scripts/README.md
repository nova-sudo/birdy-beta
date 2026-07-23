# scripts/ — deterministic tools

Axis 4 of the extension model (see `references/_extending.md`). Put **deterministic** capabilities
here — anything better done by code than by prose reasoning: building a spend-weighted scorecard,
computing a ROAS table, scanning for fatigue trends, or pulling data from the birdy backend.

The skill still *decides*; scripts just do the mechanical, repeatable parts reliably so every
invocation doesn't reinvent them.

## Convention for a new script

- **Standalone.** Runnable as `python scripts/<name>.py <args>` (or the tool's native runner) with no
  setup beyond the language runtime. Prefer the standard library; if a dependency is unavoidable, say
  so at the top of the file.
- **Documented.** A module docstring / header with: what it does, usage, expected input shape, and
  output shape. A `--help` is ideal.
- **No surprise network or writes.** If a script calls the birdy backend (needs a bearer token) or
  writes files, that must be obvious from its name and header — never a side effect. Read-only by
  default.
- **Reference it from where it's used** — the relevant playbook or SKILL.md should point at the script
  so the model knows it exists. Scripts can execute without being loaded into context.
- **Deterministic output.** Same input → same output. Keep formatting stable so results are diffable.

## Current scripts

- **`validate_skill.py`** — checks the skill's internal consistency: every path in SKILL.md's
  Capability Registry points to a real file, and every module under `references/{sources,playbooks,
  templates}/` is registered. Run it after adding or moving any module:
  ```bash
  python scripts/validate_skill.py
  ```
  Exits non-zero and lists problems if the registry and the files have drifted apart.
