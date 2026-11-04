#!/usr/bin/env bash
# Deploys CoC Stats on an Ubuntu/Debian VPS that already serves sites with Caddy.
#
#   Look first (changes nothing):
#     curl -fsSL https://raw.githubusercontent.com/Sanjivortex/coc/main/deploy/setup-vps.sh | sudo bash -s -- --check coc.test-hub.xyz
#   Install / update:
#     curl -fsSL https://raw.githubusercontent.com/Sanjivortex/coc/main/deploy/setup-vps.sh | sudo bash -s -- coc.test-hub.xyz
#
# Re-running updates the code, rebuilds and restarts. The only change to Caddy is one new site
# block appended to the Caddyfile, after a backup and `caddy validate`, so existing sites keep working.
# Node.js 22 is installed privately in /opt/coc-node; other apps keep their own Node version.
set -euo pipefail

CHECK_ONLY=0
if [ "${1:-}" = "--check" ]; then
  CHECK_ONLY=1
  shift
fi
DOMAIN="${1:-}"
REPO_URL="${REPO_URL:-https://github.com/Sanjivortex/coc.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/coc}"
APP_USER="${APP_USER:-coc}"
SERVICE="${SERVICE:-coc}"
NODE_DIR="${NODE_DIR:-/opt/coc-node}"
CADDYFILE="${CADDYFILE:-/etc/caddy/Caddyfile}"
UNIT="/etc/systemd/system/$SERVICE.service"
ENV_FILE="$APP_DIR/.env.local"

log() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;35m!! %s\033[0m\n' "$*"; }
die() {
  printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2
  exit 1
}

[ -n "$DOMAIN" ] || die "Usage: setup-vps.sh [--check] <domain>, e.g. coc.test-hub.xyz"
[ "$(id -u)" -eq 0 ] || die "Run as root (sudo)."

# Ports used by listening sockets, or mentioned anywhere in the Caddyfile (localhost:3000, :3000, …)
# so an app that is down right now does not lose its port to us.
port_taken() {
  ss -ltnH "( sport = :$1 )" 2>/dev/null | grep -q . && return 0
  [ -f "$CADDYFILE" ] && grep -vE '^[[:space:]]*#' "$CADDYFILE" | grep -qE ":$1([^0-9]|$)"
}

list_sites() {
  log "Sites in $CADDYFILE"
  if [ ! -f "$CADDYFILE" ]; then
    echo "  $CADDYFILE not found (if Caddy runs in Docker: docker ps | grep -i caddy)"
    return
  fi
  # Site blocks start at column 0 with an address and '{'; skip the global '{' block and '(snippet)' blocks.
  awk -v f="$CADDYFILE" '
    /^[^#[:space:]{(][^{]*\{[[:space:]]*$/ { line = $0; sub(/[[:space:]]*\{[[:space:]]*$/, "", line); print "  - " line; n++ }
    END { printf "  (%d site blocks)\n", n }
  ' "$CADDYFILE"
  grep -E '^import[[:space:]]' "$CADDYFILE" | sed 's/^/  also loads sites from: /' || true
}

check_dns() {
  local server_ip dns_ip
  server_ip=$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)
  dns_ip=$(getent ahostsv4 "$DOMAIN" | awk 'NR == 1 { print $1 }' || true)
  echo "  this server: ${server_ip:-unknown}   $DOMAIN → ${dns_ip:-not found}"
  if [ -z "$dns_ip" ]; then
    warn "Add a DNS A record: ${DOMAIN%%.*} → ${server_ip:-the VPS IP}. Caddy gets the HTTPS certificate once it resolves."
  elif [ -n "$server_ip" ] && [ "$dns_ip" != "$server_ip" ]; then
    warn "$DOMAIN points to $dns_ip, not to this server ($server_ip). Fix the A record."
  fi
}

list_sites
log "Listening ports"
ss -ltnpH 2>/dev/null | awk '{ line = "  " $4 " "; for (i = 6; i <= NF; i++) line = line " " $i; print line }' | sort -u || true
log "DNS"
check_dns
if [ "$CHECK_ONLY" -eq 1 ]; then
  log "Check only: nothing was changed."
  exit 0
fi

command -v apt-get >/dev/null || die "Only Ubuntu/Debian are supported."

log "System packages"
missing=()
for p in git curl ca-certificates xz-utils; do dpkg -s "$p" >/dev/null 2>&1 || missing+=("$p"); done
if [ "${#missing[@]}" -gt 0 ]; then
  apt-get update -qq
  apt-get install -y -qq "${missing[@]}"
fi
echo "  ok"

log "Node.js 22 in $NODE_DIR"
if [ ! -x "$NODE_DIR/bin/node" ] || [ "$("$NODE_DIR/bin/node" -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  case "$(uname -m)" in
    x86_64) arch=x64 ;;
    aarch64 | arm64) arch=arm64 ;;
    *) die "Unsupported CPU: $(uname -m)" ;;
  esac
  dist=https://nodejs.org/dist/latest-v22.x
  sums=$(curl -fsSL "$dist/SHASUMS256.txt")
  line=$(printf '%s\n' "$sums" | grep -m 1 -E "  node-v[0-9.]+-linux-$arch\.tar\.xz$" || true)
  [ -n "$line" ] || die "Could not find a Node.js 22 build for linux-$arch."
  file=${line##* }
  tmp=$(mktemp -d)
  curl -fsSL "$dist/$file" -o "$tmp/$file"
  (cd "$tmp" && printf '%s\n' "$line" | sha256sum -c --quiet -) || die "Node.js download checksum mismatch."
  rm -rf "$NODE_DIR"
  mkdir -p "$NODE_DIR"
  tar -xJf "$tmp/$file" -C "$NODE_DIR" --strip-components=1
  rm -rf "$tmp"
fi
echo "  node $("$NODE_DIR/bin/node" -v)"

id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "/var/lib/$APP_USER" --shell /usr/sbin/nologin "$APP_USER"
APP_HOME=$(getent passwd "$APP_USER" | cut -d: -f6)
as_app() { runuser -u "$APP_USER" -- env HOME="$APP_HOME" PATH="$NODE_DIR/bin:/usr/local/bin:/usr/bin:/bin" NEXT_TELEMETRY_DISABLED=1 "$@"; }

if [ -d "$APP_DIR/.git" ]; then
  log "Updating code in $APP_DIR"
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
  as_app git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
  as_app git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  log "Downloading code to $APP_DIR"
  if [ -e "$APP_DIR" ] && [ -n "$(ls -A "$APP_DIR")" ]; then die "$APP_DIR exists and is not empty."; fi
  mkdir -p "$APP_DIR"
  chown "$APP_USER:$APP_USER" "$APP_DIR"
  as_app git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
# Everything below (npm especially) runs inside the app, not in the caller's directory.
cd "$APP_DIR"

if [ ! -s "$ENV_FILE" ]; then
  log "Clash of Clans API token"
  token="${COC_API_TOKEN:-}"
  if [ -z "$token" ]; then
    [ -r /dev/tty ] || die "No terminal to ask for the token: run with COC_API_TOKEN=... in the environment."
    read -rsp "  Paste the token from developer.clashofclans.com (input hidden): " token </dev/tty
    echo
  fi
  [ -n "$token" ] || die "Empty token."
  # The header goes through stdin so the token does not show up in the process list.
  api_ok() { printf 'Authorization: Bearer %s\n' "$token" | curl -fs --max-time 10 -o /dev/null -H @- "$1/locations?limit=1"; }
  base=""
  if api_ok https://api.clashofclans.com/v1; then
    echo "  token works directly from this server"
  elif api_ok https://cocproxy.royaleapi.dev/v1; then
    base=https://cocproxy.royaleapi.dev/v1
    echo "  token works through the RoyaleAPI proxy"
  else
    die "The token was rejected. Create a key on developer.clashofclans.com for this server's IP ($(curl -fsS --max-time 5 https://api.ipify.org || echo unknown)) and run again."
  fi
  (
    umask 077
    printf 'COC_API_TOKEN=%s\n' "$token" >"$ENV_FILE"
    if [ -n "$base" ]; then printf 'COC_API_BASE=%s\n' "$base" >>"$ENV_FILE"; fi
  )
  chown "$APP_USER:$APP_USER" "$ENV_FILE"
fi

# KEY=value lines in .env.local; rewritten in place so the owner and mode stay the same.
env_has() { grep -qE "^$1=.+" "$ENV_FILE"; }
del_env() {
  local rest
  rest=$(grep -vE "^$1=" "$ENV_FILE" || true)
  printf '%s\n' "$rest" | sed '/^$/d' >"$ENV_FILE"
}
set_env() {
  del_env "$1"
  printf '%s=%s\n' "$1" "$2" >>"$ENV_FILE"
}
alerts() { as_app node --env-file="$ENV_FILE" "$APP_DIR/scripts/telegram-alerts.mjs" "$@"; }

if ! env_has TELEGRAM_CHAT_ID; then
  log "Telegram builder alerts (optional)"
  tg="${TELEGRAM_BOT_TOKEN:-}"
  if [ -z "$tg" ] && [ -r /dev/tty ]; then
    read -rsp "  Bot token from @BotFather (input hidden, Enter to skip): " tg </dev/tty
    echo
  fi
  if [ -z "$tg" ]; then
    echo "  skipped (run this script again to set it up)"
  else
    set_env TELEGRAM_BOT_TOKEN "$tg"
    if ! bot=$(alerts --check); then
      del_env TELEGRAM_BOT_TOKEN
      die "Telegram rejected the bot token. Copy it again from @BotFather and rerun."
    fi
    echo "  bot: $bot"
    ptag="${ALERT_PLAYER_TAG:-}"
    if [ -z "$ptag" ]; then
      [ -r /dev/tty ] || die "No terminal: run with ALERT_PLAYER_TAG=... in the environment."
      read -rp "  Your player tag, e.g. #9Y9PGP9VP: " ptag </dev/tty
    fi
    # Stored without '#': dotenv parsers treat '#' as the start of a comment.
    ptag=$(printf '%s' "$ptag" | tr -d '#[:space:]' | tr '[:lower:]' '[:upper:]')
    [ -n "$ptag" ] || die "Empty player tag."
    set_env ALERT_PLAYER_TAG "$ptag"
    chat="${TELEGRAM_CHAT_ID:-}"
    if [ -z "$chat" ]; then
      [ -r /dev/tty ] || die "No terminal: run with TELEGRAM_CHAT_ID=... in the environment."
      echo "  Open https://t.me/${bot#@} in Telegram and send /start, then press Enter here."
      read -r _ </dev/tty
      chat=$(alerts --chat-id) || die "No /start message reached the bot. Send /start to $bot and rerun."
    fi
    set_env TELEGRAM_CHAT_ID "$chat"
    alerts --test || die "Could not send the test message."
  fi
fi

log "Installing packages and building (takes a minute or two)"
as_app npm ci --no-audit --no-fund
as_app npm run build

log "App service"
PORT="${PORT:-}"
if [ -z "$PORT" ] && [ -f "$UNIT" ]; then PORT=$(grep -oE -- '-p [0-9]+' "$UNIT" | awk '{ print $2 }' || true); fi
if [ -z "$PORT" ]; then
  # 3000 is every Node app's default; start higher so a stopped app does not collide with us later.
  PORT=3900
  while port_taken "$PORT"; do PORT=$((PORT + 1)); done
fi
cat >"$UNIT" <<EOF
[Unit]
Description=CoC Stats (Next.js) for $DOMAIN
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=NEXT_TELEMETRY_DISABLED=1
ExecStart=$NODE_DIR/bin/node $APP_DIR/node_modules/next/dist/bin/next start -H 127.0.0.1 -p $PORT
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null 2>&1
systemctl restart "$SERVICE"
for _ in $(seq 1 30); do
  curl -fs -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 1
done
if ! curl -fsS -o /dev/null "http://127.0.0.1:$PORT/"; then
  journalctl -u "$SERVICE" -n 30 --no-pager || true
  die "The app did not start on port $PORT (logs above)."
fi
echo "  running on 127.0.0.1:$PORT"

ALERTS_SERVICE="$SERVICE-alerts"
ALERTS_UNIT="/etc/systemd/system/$ALERTS_SERVICE.service"
if env_has TELEGRAM_CHAT_ID; then
  log "Telegram alerts service"
  cat >"$ALERTS_UNIT" <<EOF
[Unit]
Description=CoC Stats Telegram builder alerts
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
ExecStart=$NODE_DIR/bin/node --env-file=$ENV_FILE $APP_DIR/scripts/telegram-alerts.mjs
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable "$ALERTS_SERVICE" >/dev/null 2>&1
  systemctl restart "$ALERTS_SERVICE"
  echo "  running (logs: journalctl -u $ALERTS_SERVICE -f)"
fi

log "Caddy"
if ! command -v caddy >/dev/null || [ ! -f "$CADDYFILE" ]; then
  warn "No Caddy service config at $CADDYFILE. Add this block to your Caddy config and reload Caddy:"
  printf '\n%s {\n\treverse_proxy 127.0.0.1:%s\n}\n\n' "$DOMAIN" "$PORT"
  warn "If Caddy runs in Docker, 127.0.0.1 is the container itself: use the host's address instead."
  exit 0
fi
domain_re=${DOMAIN//./\\.}
if grep -qE "^[^#]*(^|[[:space:],/])$domain_re([[:space:],:{]|$)" "$CADDYFILE"; then
  echo "  $DOMAIN is already in $CADDYFILE (left as is)"
else
  backup="$CADDYFILE.bak-$(date +%Y%m%d-%H%M%S)"
  cp -a "$CADDYFILE" "$backup"
  printf '\n# CoC Stats (deploy/setup-vps.sh)\n%s {\n\treverse_proxy 127.0.0.1:%s\n}\n' "$DOMAIN" "$PORT" >>"$CADDYFILE"
  if ! out=$(caddy validate --config "$CADDYFILE" --adapter caddyfile 2>&1); then
    cp -a "$backup" "$CADDYFILE"
    printf '%s\n' "$out" | tail -n 5
    die "Caddy rejected the new config, so the original Caddyfile was put back."
  fi
  systemctl reload caddy || die "Caddy reload failed; the previous config is still running. Backup: $backup"
  echo "  added $DOMAIN → 127.0.0.1:$PORT (backup: $backup)"
fi
list_sites

log "Done: https://$DOMAIN"
check_dns
echo "  Update later: run the same command again."
echo "  Logs: journalctl -u $SERVICE -f"
