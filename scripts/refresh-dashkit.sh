#!/usr/bin/env bash
# Rebuilds dashkit, packs it and vendors the tarball into this repo, then
# reinstalls it. Birdy depends on "dashkit": "file:vendor/dashkit-<version>.tgz"
# (the version in dashkit's package.json), so fresh clones and deploys (Vercel)
# install it without the dashkit repo. After a version bump, delete the old
# vendor/dashkit-*.tgz; npm install below repoints package.json at the new one.
# Usage: DASHKIT_DIR=/path/to/dashkit scripts/refresh-dashkit.sh
# Commit vendor/dashkit-*.tgz and package-lock.json afterwards.
set -euo pipefail
cd "$(dirname "$0")/.."

DASHKIT_DIR="${DASHKIT_DIR:-../../dashkit}"
if [ ! -f "$DASHKIT_DIR/package.json" ]; then
  echo "dashkit not found at $DASHKIT_DIR (set DASHKIT_DIR)" >&2
  exit 1
fi

TGZ="$(cd "$DASHKIT_DIR" && npm run build >&2 && npm pack --silent | tail -n 1)"
mkdir -p vendor
cp "$DASHKIT_DIR/$TGZ" "vendor/$TGZ"
echo "Vendored $DASHKIT_DIR/$TGZ -> vendor/$TGZ"

# A version bump renames the tarball: point package.json at the new file.
if ! grep -q "\"dashkit\": \"file:vendor/$TGZ\"" package.json; then
  echo "package.json does not reference vendor/$TGZ; update the dashkit dependency, then re-run npm install" >&2
fi
# npm caches file: tarballs by integrity; reinstall so the lockfile picks up the new one.
npm install dashkit@"file:vendor/$TGZ"
