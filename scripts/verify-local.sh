#!/usr/bin/env bash
#
# End-to-end check of the benmor2026.com/la door against a local LATrip,
# without deploying anything.
#
# It proves the three things the proxy is responsible for: the path rewrite,
# the cookie re-scoping, and that LATrip's own cache and security headers reach
# the browser unchanged. It also proves the app still works unproxied at its
# own origin, which is the regression the relative-URL change could cause.
#
# Run both Workers first, in two shells:
#     npm run dev                    # LATrip  on 127.0.0.1:8787
#     cd proxy && npm run dev        # proxy   on 127.0.0.1:8788
#
# Passwords are read from .dev.vars, the same file `wrangler dev` reads, so
# there is nothing to keep in step by hand and no password in this file.
# For the deployed site use scripts/smoke-test.sh instead, which takes a URL.
set -u
P=http://127.0.0.1:8788   # ben-la-proxy
O=http://127.0.0.1:8787   # LATrip origin

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ ! -f "$ROOT/.dev.vars" ]; then
  echo "No .dev.vars. Copy .dev.vars.example to .dev.vars and fill it in." >&2
  exit 1
fi
# shellcheck disable=SC1091
set -a; . "$ROOT/.dev.vars"; set +a
for v in PASSWORD_EFFI PASSWORD_GUEST; do
  if [ -z "$(eval "printf '%s' \"\${$v:-}\"")" ]; then
    echo "$v is not set in .dev.vars" >&2; exit 1
  fi
done
C() { curl -s "$@"; }
pass=0; fail=0
ok(){ printf '  PASS  %s\n' "$1"; pass=$((pass+1)); }
no(){ printf '  FAIL  %s\n     -> %s\n' "$1" "$2"; fail=$((fail+1)); }
chk(){ if [ "$2" = "$3" ]; then ok "$1"; else no "$1" "expected [$3] got [$2]"; fi; }
has(){ case "$2" in *"$3"*) ok "$1";; *) no "$1" "missing [$3]";; esac; }
hasnt(){ case "$2" in *"$3"*) no "$1" "found [$3] and should not have";; *) ok "$1";; esac; }

echo "== 1. /la redirects to /la/ =="
h=$(C -i -o - "$P/la")
chk "status 301" "$(printf '%s' "$h" | head -1 | tr -d '\r' | awk '{print $2}')" "301"
has "Location: /la/" "$h" "/la/"

echo "== 2. /la/ unauthenticated is the login page =="
b=$(C "$P/la/")
h=$(C -I "$P/la/")
has "X-Robots-Tag noarchive" "$h" "noindex, nofollow, noarchive"
has "Referrer-Policy" "$h" "no-referrer"
has "login page Cache-Control no-store" "$h" "no-store"
has "meta robots in body" "$b" 'name="robots" content="noindex, nofollow, noarchive"'
has "login form present" "$b" 'id="password"'
has "relative login fetch" "$b" "fetch('api/login'"
hasnt "no booking code leaked" "$b" "9JBMBP"
hasnt "no itinerary leaked" "$b" "Doheny"
hasnt "no flight numbers leaked" "$b" "OS84"
hasnt "no days payload leaked" "$b" "__TRIP_USER__"

echo "== 3. wrong password rejected =="
s=$(C -o /dev/null -w '%{http_code}' -X POST "$P/la/api/login" -H 'Content-Type: application/json' -d '{"user":"effi","password":"wrong"}')
chk "status 401" "$s" "401"

echo "== 4. correct password sets a cookie scoped to /la =="
h=$(C -i -o - -X POST "$P/la/api/login" -H 'Content-Type: application/json' -d '{"user":"effi","password":"'"$PASSWORD_EFFI"'"}')
sc=$(printf '%s' "$h" | tr -d '\r' | grep -i '^set-cookie:' | head -1)
has "Set-Cookie present" "$sc" "trip_session="
has "Path=/la" "$sc" "Path=/la"
hasnt "no Path=/ " "$sc" "Path=/;"
hasnt "no Domain attribute" "$sc" "Domain="
has "HttpOnly kept" "$sc" "HttpOnly"
has "Secure kept" "$sc" "Secure"
has "SameSite kept" "$sc" "SameSite=Lax"
CK=$(printf '%s' "$sc" | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1)

echo "== 5. authenticated /la/ serves the app =="
b=$(C -H "Cookie: $CK" "$P/la/")
h=$(C -I -H "Cookie: $CK" "$P/la/")
has "trip content present" "$b" "יגאל"
has "user injected" "$b" 'window.__TRIP_USER__ = "effi"'
has "relative logout fetch" "$b" "fetch('api/logout'"
has "meta robots in app" "$b" 'name="robots" content="noindex, nofollow, noarchive"'
has "ETag passed through" "$h" "ETag:"
has "cache headers NOT overridden to no-store" "$h" "private, no-cache"
hasnt "app is not no-store" "$h" "no-store"
has "Vary Cookie passed through" "$h" "Vary: Cookie"
has "CSP passed through" "$h" "Content-Security-Policy"

echo "== 6. revalidation still works through the proxy =="
et=$(printf '%s' "$h" | tr -d '\r' | grep -i '^etag:' | sed 's/^[Ee][Tt][Aa][Gg]: //')
s=$(C -o /dev/null -w '%{http_code}' -H "Cookie: $CK" -H "If-None-Match: $et" "$P/la/")
chk "304 Not Modified" "$s" "304"

echo "== 7. guest login gets the guest template, not the app =="
h=$(C -i -o - -X POST "$P/la/api/login" -H 'Content-Type: application/json' -d '{"user":"guest","password":"'"$PASSWORD_GUEST"'"}')
GK=$(printf '%s' "$h" | tr -d '\r' | grep -i '^set-cookie:' | head -1 | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1)
b=$(C -H "Cookie: $GK" "$P/la/")
has "guest itinerary present" "$b" "המסלול"
hasnt "no working mornings" "$b" "סשן"
hasnt "no booking code" "$b" "9JBMBP"
hasnt "no passenger total" "$b" "4,427"
hasnt "no Ben mission" "$b" "שלושה עסקים"

echo "== 8. logout clears the /la cookie =="
h=$(C -i -o - -X POST -H "Cookie: $CK" "$P/la/api/logout")
sc=$(printf '%s' "$h" | tr -d '\r' | grep -i '^set-cookie:' | head -1)
has "cleared cookie scoped to /la" "$sc" "Path=/la"
has "Max-Age=0" "$sc" "Max-Age=0"

echo "== 9. paths that merely start with 'la' are not swallowed =="
s=$(C -o /dev/null -w '%{http_code}' "$P/laptop")
chk "/laptop is 404 at the proxy, never rewritten" "$s" "404"

echo "== 10. the origin still works unproxied at / =="
b=$(C "$O/")
has "origin login page" "$b" 'id="password"'
has "origin relative fetch" "$b" "fetch('api/login'"
h=$(C -I "$O/")
has "origin X-Robots-Tag" "$h" "noindex, nofollow, noarchive"
s=$(C -o /dev/null -w '%{http_code}' -X POST "$O/api/login" -H 'Content-Type: application/json' -d '{"user":"ben","password":"'"$PASSWORD_BEN"'"}')
chk "origin login still 200" "$s" "200"

echo
echo "  $pass passed, $fail failed"
[ "$fail" -eq 0 ]
