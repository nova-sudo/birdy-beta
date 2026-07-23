#!/usr/bin/env python3
"""Validate the media-buying-agent skill's registry <-> module consistency.

The skill is a router: SKILL.md holds a Capability Registry that wires in every
module under references/{sources,playbooks,templates}/. This script checks the two
haven't drifted apart:

  1. Broken links  - every `references/...` or `scripts/...` path referenced in
                     SKILL.md exists on disk.
  2. Orphan modules - every module file under references/{sources,playbooks,
                     templates}/ is referenced somewhere in SKILL.md (i.e. it was
                     registered, not just dropped in and forgotten).

Usage:
    python scripts/validate_skill.py

Exits 0 if consistent, 1 if any problem is found (so it can gate CI or a pre-commit
hook). Standard library only; no network, no writes.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parent.parent
SKILL_MD = SKILL_ROOT / "SKILL.md"

# Module folders whose every *.md file must be registered in SKILL.md.
MODULE_DIRS = ("references/sources", "references/playbooks", "references/templates")

# Files that are shared infrastructure, not registry-listed ability modules.
EXEMPT_NAMES = {"_extending.md", "metrics-glossary.md", "README.md"}

# Matches backticked paths like `references/sources/meta.md` or `scripts/foo.py`.
PATH_RE = re.compile(r"`((?:references|scripts)/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+)`")


def main() -> int:
    if not SKILL_MD.exists():
        print(f"ERROR: SKILL.md not found at {SKILL_MD}", file=sys.stderr)
        return 1

    text = SKILL_MD.read_text(encoding="utf-8")
    referenced = {m.group(1) for m in PATH_RE.finditer(text)}

    problems: list[str] = []

    # 1. Broken links: referenced paths that don't exist on disk.
    for rel in sorted(referenced):
        if not (SKILL_ROOT / rel).exists():
            problems.append(f"[broken link]  SKILL.md references `{rel}` but the file does not exist")

    # 2. Orphan modules: module files on disk that SKILL.md never references.
    for rel_dir in MODULE_DIRS:
        d = SKILL_ROOT / rel_dir
        if not d.is_dir():
            continue
        for f in sorted(d.glob("*.md")):
            if f.name in EXEMPT_NAMES:
                continue
            rel = f.relative_to(SKILL_ROOT).as_posix()
            if rel not in referenced:
                problems.append(
                    f"[orphan module] {rel} exists but is not registered in SKILL.md "
                    f"(add it to the Capability registry)"
                )

    if problems:
        print(f"✗ {len(problems)} problem(s) found:\n")
        for p in problems:
            print("  " + p)
        print("\nSee references/_extending.md for the registration checklist.")
        return 1

    n_mods = sum(
        len([f for f in (SKILL_ROOT / d).glob("*.md") if f.name not in EXEMPT_NAMES])
        for d in MODULE_DIRS
        if (SKILL_ROOT / d).is_dir()
    )
    print(f"✓ Skill registry is consistent: {n_mods} modules, all registered and resolvable.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
