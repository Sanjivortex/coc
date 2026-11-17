#!/usr/bin/env bash
# Auto-deploy for CoC Stats. The coc-update timer runs this every minute. deploy/setup-vps.sh
# installs a root-owned copy at /usr/local/sbin/coc-update, so a push to GitHub never makes the VPS
# run repository code as root: git and npm below run as the app user.
#
# When the branch on GitHub has a new commit:
#   1. build it in $BUILD_DIR as the app user (npm ci only when package-lock.json changed),
#   2. if the build passes, copy it over $APP_DIR (keeping .env.local and .data/) and restart,
#   3. send a Telegram message when the bot is set up, whether it worked or not.
# A failed build leaves the running site alone, and that commit is not tried again; the next
# commit is.
#
#   journalctl -u coc-update -f             watch deploys
#   systemctl start coc-update              check now instead of at the next minute
#   systemctl disable --now coc-update.timer   turn auto-deploy off
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/coc}"
APP_USER="${APP_USER:-coc}"
SERVICE="${SERVICE:-coc}"
NODE_DIR="${NODE_DIR:-/opt/coc-node}"
BRANCH="${BRANCH:-main}"
BUILD_DIR="${BUILD_DIR:-$APP_DIR-build}"
STATE_DIR="${STATE_DIR:-/var/lib/$SERVICE-update}"
LOCK_FILE="${LOCK_FILE:-/run/$SERVICE-update.lock}"
ENV_FILE="$APP_DIR/.env.local"

# One run at a time; deploy/setup-vps.sh takes the same lock while it works.
exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

APP_HOME=$(getent passwd "$APP_USER" | cut -d: -f6)
as_app() { runuser -u "$APP_USER" -- env HOME="$APP_HOME" PATH="$NODE_DIR/bin:/usr/local/bin:/usr/bin:/bin" NEXT_TELEMETRY_DISABLED=1 "$@"; }
env_value() { sed -n "s/^$1=//p" "$ENV_FILE" 2>/dev/null | tail -n 1; }

notify() {
  local token chat
  token=$(env_value TELEGRAM_BOT_TOKEN)
  chat=$(env_value TELEGRAM_CHAT_ID)
  [ -n "$token" ] && [ -n "$chat" ] || return 0
  # The URL holding the token goes through curl's config on stdin, so it stays out of the process list.
  printf 'url = "https://api.telegram.org/bot%s/sendMessage"\n' "$token" |
    curl -fsS --max-time 15 -o /dev/null --config - --data-urlencode "chat_id=$chat" --data-urlencode "text=$1" || true
}

remote=$(as_app git -C "$APP_DIR" ls-remote origin "refs/heads/$BRANCH" 2>/dev/null | cut -f1 || true)
[ -n "$remote" ] || exit 0 # GitHub not reachable right now; the next run tries again
current=$(as_app git -C "$APP_DIR" rev-parse HEAD)
[ "$remote" != "$current" ] || exit 0
mkdir -p "$STATE_DIR"
[ "$(cat "$STATE_DIR/failed" 2>/dev/null || true)" != "$remote" ] || exit 0

echo "New commit ${remote:0:7} on $BRANCH (running ${current:0:7})"
if [ ! -e "$BUILD_DIR" ]; then
  install -d -o "$APP_USER" -g "$APP_USER" "$BUILD_DIR"
  as_app git clone --quiet --depth 1 --branch "$BRANCH" "$(as_app git -C "$APP_DIR" remote get-url origin)" "$BUILD_DIR"
elif [ -d "$BUILD_DIR/.git" ]; then
  as_app git -C "$BUILD_DIR" fetch --quiet --depth 1 origin "$BRANCH"
  as_app git -C "$BUILD_DIR" reset --quiet --hard FETCH_HEAD
  # Keep node_modules and the build cache between deploys; drop everything else that is not in git.
  as_app git -C "$BUILD_DIR" clean -q -fdx -e /node_modules -e /.next
else
  echo "$BUILD_DIR exists but is not a git checkout. Move it away and the next run starts fresh." >&2
  exit 1
fi
cd "$BUILD_DIR"
deployed=$(as_app git rev-parse HEAD)
subject=$(as_app git log -1 --format=%s)

fail() {
  printf '%s\n' "$deployed" >"$STATE_DIR/failed"
  echo "Deploy of ${deployed:0:7} failed: $1" >&2
  notify "❌ Website update fail: ${deployed:0:7} ($1). Purani website chal rahi hai (${current:0:7}). Logs: journalctl -u $SERVICE-update -n 80"
  exit 1
}

if [ -f "$ENV_FILE" ]; then install -m 600 -o "$APP_USER" -g "$APP_USER" "$ENV_FILE" "$BUILD_DIR/.env.local"; fi

lock_hash=$(sha256sum package-lock.json | cut -d' ' -f1)
stamp="$BUILD_DIR/node_modules/.coc-lock-hash"
if [ "$(cat "$stamp" 2>/dev/null || true)" != "$lock_hash" ]; then
  as_app npm ci --no-audit --no-fund || fail "npm ci"
  printf '%s\n' "$lock_hash" | as_app tee "$stamp" >/dev/null
fi
as_app npm run build || fail "build"

# The build passed: copy it over the running app. .env.local and .data/ (Telegram alert state) stay.
as_app rsync -a --delete --exclude=/.env.local --exclude=/.data/ "$BUILD_DIR/" "$APP_DIR/" || fail "copy to $APP_DIR"
rm -f "$STATE_DIR/failed"
systemctl restart "$SERVICE"
if systemctl is-enabled --quiet "$SERVICE-alerts" 2>/dev/null; then systemctl restart "$SERVICE-alerts"; fi

port=$(grep -oE -- '-p [0-9]+' "/etc/systemd/system/$SERVICE.service" 2>/dev/null | awk '{ print $2 }' || true)
for _ in $(seq 1 30); do
  if curl -fs -o /dev/null "http://127.0.0.1:$port/"; then
    echo "Deployed ${deployed:0:7}: $subject"
    notify "✅ Website update ho gayi: ${deployed:0:7} $subject"
    exit 0
  fi
  sleep 1
done
echo "Deployed ${deployed:0:7}, but the app does not answer on port $port" >&2
notify "⚠️ Website ${deployed:0:7} pe update hui, par port $port pe jawab nahi de rahi. Logs: journalctl -u $SERVICE -n 50"
exit 1
