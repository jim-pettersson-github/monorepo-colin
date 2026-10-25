# Game server

A small PHP 8 + SQLite room server at https://games.charliecare.se. It lets game devices find each other with a four-character room code. The server only passes WebRTC pairing codes between the devices. The game traffic then goes directly between them, using public STUN servers to find each device's internet address.

## Files

- `public/api.php`: the JSON API. It creates `games.sqlite` next to itself on first use, or at the path in `GAME_DB`.
- `public/.htaccess`: blocks direct downloads of the database.
- `public/index.html`: a short info page.

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

Some networks, often mobile data, block direct contact between two devices. A TURN relay forwards the game traffic for them. With a Cloudflare Realtime TURN key, `ice` hands out day-long Cloudflare credentials, cached on the server; without one, devices get STUN only and those networks cannot connect. The key is the `CLOUDFLARE_TURN_KEY_ID` and `CLOUDFLARE_TURN_API_TOKEN` repository secrets. The deploy writes them to `public/config.php`, which is ignored by Git and blocked from download. After changing the secrets, run the workflow again.

## Run locally

```bash
php -S 127.0.0.1:4019 -t game-server/public
```

The Charlie for Speed Playwright tests start this server themselves.

## Deploy

`.github/workflows/game-server.yml` uploads `public/` over FTPS to the `games.charliecare.se` webroot (`webroots/0e182b4e`) on pushes to `main` that change this folder. It then checks `?a=health` and that the database cannot be downloaded. The FTP host and users are set in the workflow (it tries the games user, then the main user); the password is the `GAMES_FTP_PASSWORD` repository secret. The upload never overwrites the live database.
