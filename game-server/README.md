# Game server

A small PHP 8 + SQLite room server at https://games.charliecare.se. It lets game devices find each other with a four-character room code. The server only passes WebRTC pairing codes between the devices. The game traffic then goes directly between them, using public STUN servers to find each device's internet address. When two networks block direct contact, the server's own TURN relay (coturn, in the same container) forwards the traffic instead.

## Files

- `public/api.php`: the JSON API. It creates `games.sqlite` next to itself on first use, or at the path in `GAME_DB`.
- `public/.htaccess`: blocks direct downloads of a database or `config.php` kept next to the API.
- `public/index.html`: a short info page.
- `Dockerfile`, `docker/entrypoint.sh`: Apache + PHP 8.5 and coturn in one container. The database lives in the `/data` volume.
- `docker-compose.yaml`: the Dokploy stack on the home dev host.
- `release.mjs` (`npm run release`): deploys the pushed server and checks it.

## API

Every call is `api.php?a=<action>`. POST bodies are JSON sent as `text/plain`, which avoids a CORS preflight. Responses allow any origin.

| Action | Who | Request | Response |
| --- | --- | --- | --- |
| `health` | anyone | GET | `{ ok, php, rooms, relay }` |
| `ice` | anyone | GET | `{ iceServers }`: STUN, plus TURN relay credentials when a relay key is set |
| `create` | host | `{ game }` | `{ code, host }` |
| `offer` | host | `{ code, host, offer }` | `{ id }`; replaces the open invitation |
| `answer` | host | GET `code`, `host`, `id` | `{ answer }` or `{ waiting: true }` |
| `claim` | guest | `{ code }` | `{ offer, claim, game }` or `{ waiting: true }` |
| `reply` | guest | `{ code, claim, answer }` | `{ ok }`, or 409 if the claim expired |
| `announce` | host | `{ code, host, listed, title, info, players, capacity }` | `{ ok }`; a heartbeat every few seconds keeps the game on the list |
| `list` | anyone | GET `game` | `{ games: [{ code, title, info, players, capacity }] }`: listed, not full, announced in the last 20 seconds |
| `close` | host | `{ code, host }` | `{ ok }` |

Each room holds one open invitation at a time. A guest's claim reserves it for 30 seconds. Rooms expire 12 hours after their last use.

## Relay for strict networks

Some networks block direct contact between two devices: mobile data behind carrier NAT, or Wi-Fi that isolates its clients from each other. A TURN relay forwards the game traffic for them, and the games use it on their own when nothing else gets through.

The container runs coturn next to the API. Both read `TURN_SECRET`. `ice` hands each device credentials that expire after a day: the user name is `<expiry>:game` and the password is its HMAC-SHA1 with the secret, the standard TURN REST scheme, so coturn never stores users. `TURN_URLS` lists the relay addresses handed out, and `TURN_PUBLIC_HOST` is a name for the public IP that coturn puts in its relay candidates. The relay refuses to forward to private, loopback and Tailscale addresses, because it sits inside the home network.

Without `TURN_SECRET`, `ice` falls back to a Cloudflare Realtime TURN key (`cloudflare_turn_key_id` and `cloudflare_turn_api_token` in the environment or `public/config.php`), and then to STUN only.

## Run locally

```bash
php -S 127.0.0.1:4019 -t game-server/public
```

The Charlie for Speed Playwright tests start this server themselves.

## Hosting

The server runs on the home dev host (the NUC behind `vps.academy.charliecare.se`) as the Dokploy stack `game-server` in the project `games`. Dokploy builds `docker-compose.yaml` from this public repository's `main` branch. Traefik serves `games.charliecare.se` over HTTPS with a Let's Encrypt certificate. The TURN ports bypass Traefik:

| Port | Use | Router |
| --- | --- | --- |
| 3478 UDP and TCP | TURN, and STUN | forwarded to the NUC (192.168.1.221) |
| 49160–49259 UDP | relayed traffic, one port per allocation | forwarded to the NUC |

Two relayed devices meet inside coturn, so their traffic never leaves the NUC (checked with tcpdump); the forwarded range serves a device that reaches a relayed one directly. The ports are published 1:1 from the container, and Docker opens them past ufw by itself. The Dokploy variable `GAMES_TURN_SECRET` holds the secret (`openssl rand -hex 32`). DNS: `games.charliecare.se` is a CNAME to `vps.academy.charliecare.se`.

When the home IP changes, the container notices within five minutes and restarts with the new address.

Run the container locally:

```bash
docker build -t game-server game-server
docker run --rm -p 18190:80 -p 3478:3478/udp -p 3478:3478/tcp -e TURN_SECRET=test -e "TURN_URLS=turn:127.0.0.1:3478?transport=udp" -e TURN_ALLOW_PRIVATE_PEERS=1 game-server
```

`TURN_ALLOW_PRIVATE_PEERS=1` is for local tests only, where every relay address is a container address.

## Deploy

Dokploy builds from `main`, and a push does not deploy by itself. After pushing a server change, release it from a computer on the home network or Tailscale:

```bash
cd game-server
npm run release
```

`release.mjs` refuses while `game-server/` has uncommitted or unpushed changes. It then deploys the `game-server` stack in the `games` project through Dokploy's API, waits for the build, and checks that the live API answers with its relay on. If the build fails, it prints the build log, read over SSH from the NUC. It needs `DOKPLOY_API_KEY` in `game-server/.env`, which Git ignores ([.env.example](.env.example)). `DOKPLOY_URL` defaults to `http://192.168.1.221:3000`.

`.github/workflows/game-server.yml` checks on every push that the image builds and the live server answers.
