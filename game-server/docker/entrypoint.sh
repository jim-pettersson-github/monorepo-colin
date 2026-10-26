#!/usr/bin/env bash
# Starts the room server (Apache + PHP) and, when a relay secret is set, coturn beside it.
# The container stops when either one stops, and Docker's restart policy brings both back.
set -euo pipefail

chown www-data:www-data /data

public_ip() {
  getent ahostsv4 "$1" | awk 'NR == 1 { print $1 }'
}

if [ -n "${TURN_SECRET:-}" ]; then
  conf=/etc/turnserver.conf
  cat > "$conf" <<CONF
listening-port=3478
min-port=${TURN_MIN_PORT:-49160}
max-port=${TURN_MAX_PORT:-49259}
realm=${TURN_REALM:-games.charliecare.se}
use-auth-secret
static-auth-secret=${TURN_SECRET}
fingerprint
no-tls
no-dtls
no-cli
no-multicast-peers
no-software-attribute
user-quota=40
proc-user=turnserver
proc-group=turnserver
log-file=stdout
simple-log
CONF

  # Behind the home router, relay candidates must name the public address, not the container's own.
  public=""
  if [ -n "${TURN_PUBLIC_HOST:-}" ]; then
    public=$(public_ip "$TURN_PUBLIC_HOST")
    [ -n "$public" ] || { echo "game-server: $TURN_PUBLIC_HOST does not resolve" >&2; exit 1; }
    # Published ports arrive on the interface with the default route (Docker's gateway bridge when the
    # container also sits on Dokploy's overlay network), so relay there and map that address.
    private=$(ip -4 route get 1.1.1.1 | awk '{ for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1) }')
    printf 'relay-ip=%s\nexternal-ip=%s/%s\n' "$private" "$public" "$private" >> "$conf"
  fi

  # The relay sits inside the home network: it may only forward to the internet, never to local addresses.
  # Local tests turn this off, because there every peer is a container address.
  if [ "${TURN_ALLOW_PRIVATE_PEERS:-}" != 1 ]; then
    for range in 0.0.0.0-0.255.255.255 10.0.0.0-10.255.255.255 100.64.0.0-100.127.255.255 127.0.0.0-127.255.255.255 \
      169.254.0.0-169.254.255.255 172.16.0.0-172.31.255.255 192.168.0.0-192.168.255.255 ::1 fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff \
      fe80::-febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff; do
      echo "denied-peer-ip=$range" >> "$conf"
    done
  fi

  turnserver -c "$conf" &
  echo "game-server: relay on 3478 (udp, tcp)${public:+, public address $public}"

  # A new home IP needs new relay candidates: stop when the name moves, and the restart picks it up.
  if [ -n "$public" ]; then
    (
      while sleep 300; do
        now=$(public_ip "$TURN_PUBLIC_HOST" || true)
        if [ -n "$now" ] && [ "$now" != "$public" ]; then
          echo "game-server: public address moved to $now, restarting" >&2
          exit 0
        fi
      done
    ) &
  fi
else
  echo "game-server: no TURN_SECRET, relay off (devices get STUN only)"
fi

apache2-foreground &
wait -n
exit 1
