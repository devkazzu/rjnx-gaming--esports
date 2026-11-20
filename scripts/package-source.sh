#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
archive="$tmp/rjnx-source.zip"
zip -qr "$archive" src drizzle supabase docs scripts tests public/fonts public/images public/rjnx-logo.svg package.json package-lock.json .env.example .gitignore README.md drizzle.config.ts next.config.mjs tsconfig.json eslint.config.mjs postcss.config.mjs vercel.json
unzip -tq "$archive"
unzip -Z1 "$archive" > "$tmp/list"
for file in 'src/app/(public)/page.tsx' 'src/app/dashboard/[section]/page.tsx' 'src/app/admin/[section]/page.tsx' 'src/app/api/[...resource]/route.ts' 'src/app/auth/confirm/route.ts' src/db/schema.ts drizzle/0000_rjnx_initial.sql drizzle/0001_rjnx_access.sql .env.example README.md tests/arena-api.test.mjs tests/arena-browser.test.mjs vercel.json supabase/configure.sql supabase/realtime.sql public/images/rjnx-arena.jpg; do
  grep -Fqx -- "$file" "$tmp/list" || { echo "Missing $file" >&2; exit 1; }
done
if grep -E '(^|/)(node_modules|\.next|\.git|test-results)(/|$)|(^|/)\.env($|\.(local|production|development))|\.(pem|key)$' "$tmp/list"; then
  echo 'Unexpected private or generated archive entry' >&2; exit 1
fi
mv "$archive" public/rjnx-source.zip
printf 'Verified %s ZIP entries\n' "$(wc -l < "$tmp/list" | tr -d ' ')"
sha256sum public/rjnx-source.zip
