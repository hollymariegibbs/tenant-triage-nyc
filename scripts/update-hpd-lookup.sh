#!/usr/bin/env bash
#
# Refresh vendor/hpd-lookup-<version>.js from the published npm package.
#
# Tenant Triage has no build step on purpose: the site is plain HTML and JS
# served straight from GitHub Pages, and it should stay that way. So instead of
# taking an npm dependency at runtime, we vendor a single self-contained ESM
# bundle and check it in. This script regenerates that file.
#
# Usage:
#   scripts/update-hpd-lookup.sh            # latest published version
#   scripts/update-hpd-lookup.sh 1.2.0      # a specific version
#
# After running, update the import in lookup.js to the new filename and
# commit both the new vendor file and the removal of the old one.

set -euo pipefail

PKG="@howellandgibbs/hpd-lookup"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${1:-$(npm view "$PKG" version)}"
OUT="$ROOT/vendor/hpd-lookup-$VERSION.js"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Fetching $PKG@$VERSION…"
( cd "$WORK" && npm pack --silent "$PKG@$VERSION" >/dev/null && tar -xzf ./*.tgz )

echo "Bundling to vendor/hpd-lookup-$VERSION.js…"
mkdir -p "$ROOT/vendor"
npx --yes esbuild "$WORK/package/dist/index.js" \
  --bundle \
  --format=esm \
  --platform=browser \
  --target=es2020 \
  --legal-comments=none \
  --banner:js="/*! $PKG v$VERSION | MIT | https://github.com/howellandgibbs/hpd-lookup
 * Vendored build — do not edit by hand.
 * Regenerate with scripts/update-hpd-lookup.sh
 */" \
  --outfile="$OUT"

echo
echo "Wrote $OUT"
echo "Next: point the import at the top of lookup.js at the new filename,"
echo "      then delete the previous vendor/hpd-lookup-*.js."
