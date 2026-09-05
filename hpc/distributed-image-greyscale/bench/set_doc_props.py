#!/usr/bin/env python3
"""
set_doc_props.py -- Set the document properties of a finished .xlsx in place.

Deliberately edits the package XML rather than re-saving through openpyxl:
openpyxl writes formulas with no cached values, so a re-save after
recalculation would blank every computed cell for anything that reads cached
values (pandas, previewers, Excel's own first paint).

Usage: python3 bench/set_doc_props.py <file.xlsx> [author]
       (an empty author clears the field rather than naming a tool)
"""
import re
import shutil
import sys
import zipfile
import os

PATH   = sys.argv[1]
AUTHOR = sys.argv[2] if len(sys.argv) > 2 else ""
TMP    = PATH + ".tmp"


def set_tag(xml, tag, value):
    """Replace <tag>...</tag> (or a self-closing <tag/>) with <tag>value</tag>."""
    pat = re.compile(rf"<{tag}(\s[^>]*)?/>|<{tag}(\s[^>]*)?>.*?</{tag}>", re.S)
    if pat.search(xml):
        return pat.sub(f"<{tag}>{value}</{tag}>", xml, count=1)
    return xml


def main():
    with zipfile.ZipFile(PATH) as zin:
        names = zin.namelist()
        blobs = {n: zin.read(n) for n in names}

    core = blobs.get("docProps/core.xml")
    if core:
        x = core.decode("utf-8")
        x = set_tag(x, "dc:creator", AUTHOR)
        x = set_tag(x, "cp:lastModifiedBy", AUTHOR)
        blobs["docProps/core.xml"] = x.encode("utf-8")

    with zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as zout:
        for n in names:                      # preserve original entry order
            zout.writestr(n, blobs[n])
    shutil.move(TMP, PATH)
    print(f"{PATH}: creator/lastModifiedBy set to {AUTHOR!r}")


if __name__ == "__main__":
    main()
