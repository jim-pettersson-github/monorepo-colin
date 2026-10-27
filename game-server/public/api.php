<?php

declare(strict_types=1);

// Room codes for pairing game devices over the internet. The host posts one WebRTC offer at a time, a guest
// claims it with the room code and posts its answer back; the game traffic itself goes directly between devices.

const ROOM_TTL = 12 * 3600;
const CLAIM_TTL = 30;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_SIGNAL = 6000;
const LIST_STALE = 20;

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Max-Age: 86400');
header('Cache-Control: no-store');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function reply(array $body, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function database(): PDO
{
    $path = getenv('GAME_DB') ?: __DIR__ . '/games.sqlite';
    $db = new PDO('sqlite:' . $path, options: [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $db->exec('PRAGMA busy_timeout = 4000');
    $db->exec(
        'CREATE TABLE IF NOT EXISTS rooms (
            code TEXT PRIMARY KEY,
            game TEXT NOT NULL,
            host TEXT NOT NULL,
            offer TEXT,
            offer_id INTEGER NOT NULL DEFAULT 0,
            claim TEXT,
            claimed_at INTEGER,
            answer TEXT,
            updated INTEGER NOT NULL
        )'
    );
    // Open-game listing, added after the first release; older databases get the columns on first use.
    $columns = array_column($db->query('PRAGMA table_info(rooms)')->fetchAll(), 'name');
    foreach (['listed INTEGER NOT NULL DEFAULT 0', 'title TEXT', 'info TEXT', 'players INTEGER NOT NULL DEFAULT 1', 'capacity INTEGER NOT NULL DEFAULT 2', 'seen INTEGER NOT NULL DEFAULT 0', 'version TEXT'] as $column) {
        if (!in_array(strtok($column, ' '), $columns, true)) $db->exec("ALTER TABLE rooms ADD COLUMN $column");
    }
    return $db;
}

function input(): array
{
    $body = json_decode(file_get_contents('php://input', length: 20000) ?: '', true);
    return is_array($body) ? $body : [];
}

function text(array $body, string $key, string $pattern): string
{
    $value = $body[$key] ?? null;
    if (!is_string($value) || !preg_match($pattern, $value)) reply(['error' => "Ogiltigt fält: $key"], 400);
    return $value;
}

function token(): string
{
    return bin2hex(random_bytes(16));
}

function room(PDO $db, string $code): array
{
    $statement = $db->prepare('SELECT * FROM rooms WHERE code = ? AND updated > ?');
    $statement->execute([$code, time() - ROOM_TTL]);
    $room = $statement->fetch();
    if (!$room) reply(['error' => 'Rummet finns inte. Kolla koden.'], 404);
    return $room;
}

function hostRoom(PDO $db, array $body): array
{
    $room = room($db, text($body, 'code', '/^[A-Z0-9]{4}$/'));
    if (!hash_equals($room['host'], text($body, 'host', '/^[a-f0-9]{32}$/'))) reply(['error' => 'Fel värdnyckel.'], 403);
    return $room;
}

const STUN = [['urls' => ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302']]];
const ICE_TTL = 24 * 3600;

// Settings come from the container's environment (TURN_SECRET), or from config.php on plain PHP hosting.
function setting(string $name): string
{
    static $config = null;
    $config ??= is_file(__DIR__ . '/config.php') ? require __DIR__ . '/config.php' : [];
    $value = getenv(strtoupper($name));
    return is_string($value) && $value !== '' ? $value : (string) ($config[$name] ?? '');
}

function ownRelay(): bool
{
    return setting('turn_secret') !== '' && setting('turn_urls') !== '';
}

// TURN relays the game traffic when two networks block direct contact. The relay secret stays on the server;
// devices get credentials that expire after a day.
function iceServers(PDO $db): array
{
    // Our own coturn, which shares the secret: the standard TURN REST scheme, expiry:name signed with HMAC-SHA1.
    // coturn counts its per-user quota on the name, so each device gets its own instead of sharing one.
    if (ownRelay()) {
        $username = (time() + ICE_TTL) . ':' . bin2hex(random_bytes(6));
        $urls = array_values(array_filter(array_map('trim', explode(',', setting('turn_urls')))));
        return [...STUN, ['urls' => $urls, 'username' => $username, 'credential' => base64_encode(hash_hmac('sha1', $username, setting('turn_secret'), true))]];
    }

    // Otherwise Cloudflare's relay, whose day-long credentials are cached for a few hours.
    $key = setting('cloudflare_turn_key_id');
    $token = setting('cloudflare_turn_api_token');
    if (!$key || !$token) return STUN;

    $db->exec('CREATE TABLE IF NOT EXISTS ice (id INTEGER PRIMARY KEY, servers TEXT NOT NULL, expires INTEGER NOT NULL)');
    $cached = $db->query('SELECT servers, expires FROM ice WHERE id = 1')->fetch();
    if ($cached && $cached['expires'] > time() + 3600) return json_decode($cached['servers'], true);

    $context = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => "Authorization: Bearer $token\r\nContent-Type: application/json\r\n",
        'content' => json_encode(['ttl' => ICE_TTL]),
        'timeout' => 6,
        'ignore_errors' => true,
    ]]);
    $response = @file_get_contents("https://rtc.live.cloudflare.com/v1/turn/keys/$key/credentials/generate-ice-servers", false, $context);
    $servers = json_decode($response ?: '', true)['iceServers'] ?? null;
    if (!is_array($servers) || !$servers) {
        error_log('game-server: TURN credentials unavailable');
        return $cached ? json_decode($cached['servers'], true) : STUN;
    }
    $db->prepare('INSERT OR REPLACE INTO ice (id, servers, expires) VALUES (1, ?, ?)')->execute([json_encode($servers), time() + ICE_TTL]);
    return $servers;
}

const LAP_MIN = 10_000;
const LAP_MAX = 30 * 60_000;
const LAP_KEEP = 35 * 86400;
const BOARD_SIZE = 20;
// Placings on each track add up to the overall table, like championship points.
const POINTS = [10, 8, 6, 5, 4, 3, 2, 1];

function laps(PDO $db): void
{
    $db->exec(
        'CREATE TABLE IF NOT EXISTS laps (
            id INTEGER PRIMARY KEY,
            at INTEGER NOT NULL,
            game TEXT NOT NULL,
            track TEXT NOT NULL,
            player TEXT NOT NULL,
            car TEXT NOT NULL,
            transmission TEXT,
            time INTEGER NOT NULL,
            version TEXT
        )'
    );
    // Quick races (alone or online) and careers rank apart, since career cars carry bought upgrades.
    $columns = array_column($db->query('PRAGMA table_info(laps)')->fetchAll(), 'name');
    foreach (["kind TEXT NOT NULL DEFAULT 'race'", 'online INTEGER NOT NULL DEFAULT 0'] as $column) {
        if (!in_array(strtok($column, ' '), $columns, true)) $db->exec("ALTER TABLE laps ADD COLUMN $column");
    }
    $db->exec('CREATE INDEX IF NOT EXISTS laps_board ON laps (game, track, player, time)');
    $db->exec('CREATE TABLE IF NOT EXISTS drivers (game TEXT NOT NULL, player TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY (game, player))');
}

// Each player's best lap per track of one kind since a time, fastest first, with the name they use now.
// SQLite takes the bare columns of a MIN() group from the row that holds the minimum.
function bests(PDO $db, string $game, string $kind, int $since, ?string $track = null): array
{
    $statement = $db->prepare(
        'SELECT l.track, l.player, d.name, l.car, l.transmission, l.online, MIN(l.time) AS time, l.at, l.id
         FROM laps l JOIN drivers d ON d.game = l.game AND d.player = l.player
         WHERE l.game = ? AND l.kind = ? AND l.at >= ? AND (? IS NULL OR l.track = ?)
         GROUP BY l.track, l.player ORDER BY l.track, time, l.id'
    );
    $statement->execute([$game, $kind, $since, $track, $track]);
    $tracks = [];
    foreach ($statement->fetchAll() as $row) $tracks[$row['track']][] = $row;
    return $tracks;
}

// A row as players see it: no device ids, only whether it is the asking player's own.
function entry(array $row, string $player): array
{
    return [
        'name' => $row['name'],
        'car' => $row['car'],
        'transmission' => $row['transmission'],
        'online' => (bool) $row['online'],
        'time' => (int) $row['time'],
        'at' => (int) $row['at'],
        'me' => $row['player'] === $player,
    ];
}

function placing(array $bests, string $player): ?array
{
    foreach ($bests as $index => $row) {
        if ($row['player'] === $player) return ['rank' => $index + 1, 'time' => (int) $row['time'], 'car' => $row['car'], 'online' => (bool) $row['online']];
    }
    return null;
}

$action = $_GET['a'] ?? '';
$signal = '/^[A-Za-z0-9._-]{16,' . MAX_SIGNAL . '}$/';

try {
    $db = database();
    $now = time();

    switch ($action) {
        case 'health':
            $count = (int) $db->query('SELECT COUNT(*) FROM rooms WHERE updated > ' . ($now - ROOM_TTL))->fetchColumn();
            $relay = ownRelay() || setting('cloudflare_turn_key_id') !== '';
            reply(['ok' => true, 'php' => PHP_VERSION, 'rooms' => $count, 'relay' => $relay]);

        case 'ice':
            reply(['iceServers' => iceServers($db)]);

        case 'create':
            $body = input();
            $game = text($body, 'game', '/^[a-z0-9-]{2,32}$/');
            $db->prepare('DELETE FROM rooms WHERE updated < ?')->execute([$now - ROOM_TTL]);
            $version = is_string($body['version'] ?? null) ? substr($body['version'], 0, 40) : null;
            $host = token();
            for ($attempt = 0; $attempt < 20; $attempt++) {
                $code = '';
                for ($i = 0; $i < 4; $i++) $code .= CODE_ALPHABET[random_int(0, strlen(CODE_ALPHABET) - 1)];
                $insert = $db->prepare('INSERT OR IGNORE INTO rooms (code, game, host, updated, version) VALUES (?, ?, ?, ?, ?)');
                $insert->execute([$code, $game, $host, $now, $version]);
                if ($insert->rowCount() === 1) reply(['code' => $code, 'host' => $host]);
            }
            reply(['error' => 'Inga lediga rumskoder just nu.'], 503);

        case 'offer':
            $body = input();
            $room = hostRoom($db, $body);
            $offer = text($body, 'offer', $signal);
            $id = (int) $room['offer_id'] + 1;
            $db->prepare('UPDATE rooms SET offer = ?, offer_id = ?, claim = NULL, claimed_at = NULL, answer = NULL, updated = ? WHERE code = ?')
                ->execute([$offer, $id, $now, $room['code']]);
            reply(['id' => $id]);

        case 'answer':
            $room = hostRoom($db, $_GET);
            $id = (int) ($_GET['id'] ?? 0);
            if ($id !== (int) $room['offer_id']) reply(['error' => 'Inbjudan har ersatts.'], 409);
            $db->prepare('UPDATE rooms SET updated = ? WHERE code = ?')->execute([$now, $room['code']]);
            reply($room['answer'] ? ['answer' => $room['answer']] : ['waiting' => true]);

        case 'claim':
            $body = input();
            $room = room($db, strtoupper(text($body, 'code', '/^[A-Za-z0-9]{4}$/')));
            $claim = token();
            $update = $db->prepare(
                'UPDATE rooms SET claim = ?, claimed_at = ?, updated = ?
                 WHERE code = ? AND offer IS NOT NULL AND answer IS NULL AND (claim IS NULL OR claimed_at < ?)'
            );
            $update->execute([$claim, $now, $now, $room['code'], $now - CLAIM_TTL]);
            if ($update->rowCount() !== 1) reply(['waiting' => true]);
            reply(['offer' => $room['offer'], 'claim' => $claim, 'game' => $room['game'], 'version' => $room['version']]);

        case 'reply':
            $body = input();
            $room = room($db, strtoupper(text($body, 'code', '/^[A-Za-z0-9]{4}$/')));
            $claim = text($body, 'claim', '/^[a-f0-9]{32}$/');
            $update = $db->prepare('UPDATE rooms SET answer = ?, updated = ? WHERE code = ? AND claim = ? AND answer IS NULL AND claimed_at >= ?');
            $update->execute([text($body, 'answer', $signal), $now, $room['code'], $claim, $now - CLAIM_TTL]);
            if ($update->rowCount() !== 1) reply(['error' => 'Inbjudan gick ut. Försök igen.'], 409);
            reply(['ok' => true]);

        // Host heartbeat for the open-game list; a room that stops announcing drops off within LIST_STALE seconds.
        case 'announce':
            $body = input();
            $room = hostRoom($db, $body);
            $players = (int) ($body['players'] ?? 1);
            $capacity = (int) ($body['capacity'] ?? 2);
            if ($players < 1 || $capacity < 2 || $capacity > 8 || $players > $capacity) reply(['error' => 'Ogiltigt antal spelare.'], 400);
            $db->prepare('UPDATE rooms SET listed = ?, title = ?, info = ?, players = ?, capacity = ?, seen = ?, updated = ? WHERE code = ?')->execute([
                empty($body['listed']) ? 0 : 1,
                text($body, 'title', '/^[^ -]{1,40}$/u'),
                text($body, 'info', '/^[^ -]{0,120}$/u'),
                $players,
                $capacity,
                $now,
                $now,
                $room['code'],
            ]);
            reply(['ok' => true]);

        case 'list':
            $game = $_GET['game'] ?? '';
            if (!is_string($game) || !preg_match('/^[a-z0-9-]{2,32}$/', $game)) reply(['error' => 'Ogiltigt spel.'], 400);
            $statement = $db->prepare(
                'SELECT code, title, info, players, capacity FROM rooms
                 WHERE game = ? AND listed = 1 AND seen > ? AND players < capacity AND (? IS NULL OR version = ?) ORDER BY seen DESC LIMIT 30'
            );
            // Only games on the same release can play together, so a versioned list hides the others.
            $version = is_string($_GET['version'] ?? null) && $_GET['version'] !== '' ? substr($_GET['version'], 0, 40) : null;
            $statement->execute([$game, $now - LIST_STALE, $version, $version]);
            reply(['games' => array_map(fn ($row) => [...$row, 'players' => (int) $row['players'], 'capacity' => (int) $row['capacity']], $statement->fetchAll())]);

        // Performance reports from online races (frame rate, update rate, device kind), so lag can be traced to a device.
        // No addresses or names: only what the game measured. The newest 5000 reports are kept.
        case 'stats':
            $body = input();
            $number = fn (string $key, float $max) => is_numeric($body[$key] ?? null) ? max(0, min($max, (float) $body[$key])) : null;
            $db->exec('CREATE TABLE IF NOT EXISTS stats (id INTEGER PRIMARY KEY, at INTEGER NOT NULL, game TEXT, version TEXT, room TEXT, role TEXT, device TEXT, fps REAL, updates REAL, players INTEGER, resolution REAL, speed REAL)');
            $db->prepare('INSERT INTO stats (at, game, version, room, role, device, fps, updates, players, resolution, speed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')->execute([
                $now,
                text($body, 'game', '/^[a-z0-9-]{2,32}$/'),
                is_string($body['version'] ?? null) ? substr($body['version'], 0, 40) : null,
                is_string($body['room'] ?? null) && preg_match('/^[A-Z0-9]{4}$/', $body['room']) ? $body['room'] : null,
                in_array($body['role'] ?? null, ['host', 'guest'], true) ? $body['role'] : null,
                in_array($body['device'] ?? null, ['android', 'ios', 'desktop'], true) ? $body['device'] : null,
                $number('fps', 240),
                $number('updates', 240),
                (int) $number('players', 8),
                $number('resolution', 4),
                $number('speed', 500),
            ]);
            $db->exec('DELETE FROM stats WHERE id <= (SELECT MAX(id) FROM stats) - 5000');
            reply(['ok' => true]);

        // A finished race's best lap for the scoreboard. Players are device ids the game makes up; the name is what
        // they typed. Each player keeps every lap of the last LAP_KEEP days and their all-time best per track.
        case 'lap':
            $body = input();
            laps($db);
            $game = text($body, 'game', '/^[a-z0-9-]{2,32}$/');
            $track = text($body, 'track', '/^[a-z0-9-]{1,32}$/');
            $player = text($body, 'player', '/^[a-z0-9]{6,40}$/');
            $name = trim(text($body, 'name', '/^[^\p{C}]{1,40}$/u'));
            if ($name === '' || mb_strlen($name) > 16) reply(['error' => 'Skriv ett namn med högst 16 tecken.'], 400);
            $kind = in_array($body['kind'] ?? 'race', ['race', 'career'], true) ? ($body['kind'] ?? 'race') : reply(['error' => 'Ogiltig sorts lopp.'], 400);
            $time = $body['time'] ?? null;
            if (!is_int($time) || $time < LAP_MIN || $time > LAP_MAX) reply(['error' => 'Ogiltig varvtid.'], 400);
            $recent = $db->prepare('SELECT COUNT(*) FROM laps WHERE game = ? AND player = ? AND at > ?');
            // A device sends one lap per race, plus any it saved while offline; more than that is not a person racing.
            $recent->execute([$game, $player, $now - 60]);
            if ((int) $recent->fetchColumn() >= 10) reply(['error' => 'Vänta lite innan nästa varv skickas.'], 429);
            $db->prepare('INSERT INTO laps (at, game, track, player, car, transmission, time, version, kind, online) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')->execute([
                $now,
                $game,
                $track,
                $player,
                text($body, 'car', '/^[a-z0-9-]{1,40}$/'),
                in_array($body['transmission'] ?? null, ['auto', 'manual'], true) ? $body['transmission'] : null,
                $time,
                is_string($body['version'] ?? null) ? substr($body['version'], 0, 40) : null,
                $kind,
                empty($body['online']) ? 0 : 1,
            ]);
            $db->prepare('INSERT INTO drivers (game, player, name) VALUES (?, ?, ?) ON CONFLICT (game, player) DO UPDATE SET name = excluded.name')
                ->execute([$game, $player, $name]);
            $db->prepare(
                'DELETE FROM laps WHERE game = ? AND kind = ? AND track = ? AND player = ? AND at < ?
                 AND id <> (SELECT id FROM laps WHERE game = ? AND kind = ? AND track = ? AND player = ? ORDER BY time, id LIMIT 1)'
            )->execute([$game, $kind, $track, $player, $now - LAP_KEEP, $game, $kind, $track, $player]);
            $bests = bests($db, $game, $kind, 0, $track)[$track] ?? [];
            $mine = placing($bests, $player);
            reply(['ok' => true, 'rank' => $mine['rank'] ?? null, 'best' => $mine['time'] ?? null, 'drivers' => count($bests)]);

        // The scoreboard: one track's top list, or every track's record and an overall table that adds up placings.
        case 'laps':
            laps($db);
            $game = $_GET['game'] ?? '';
            if (!is_string($game) || !preg_match('/^[a-z0-9-]{2,32}$/', $game)) reply(['error' => 'Ogiltigt spel.'], 400);
            $days = ['all' => 0, 'month' => 30, 'week' => 7][$_GET['period'] ?? 'all'] ?? null;
            if ($days === null) reply(['error' => 'Ogiltig period.'], 400);
            $since = $days ? $now - $days * 86400 : 0;
            $kind = $_GET['kind'] ?? 'race';
            if (!in_array($kind, ['race', 'career'], true)) reply(['error' => 'Ogiltig sorts lopp.'], 400);
            $player = is_string($_GET['player'] ?? null) ? $_GET['player'] : '';
            $track = $_GET['track'] ?? '';
            if ($track !== '') {
                if (!is_string($track) || !preg_match('/^[a-z0-9-]{1,32}$/', $track)) reply(['error' => 'Ogiltig bana.'], 400);
                $bests = bests($db, $game, $kind, $since, $track)[$track] ?? [];
                $board = array_map(fn ($row) => entry($row, $player), array_slice($bests, 0, BOARD_SIZE));
                reply(['board' => $board, 'me' => placing($bests, $player), 'drivers' => count($bests)]);
            }
            $tracks = [];
            $points = [];
            foreach (bests($db, $game, $kind, $since) as $id => $bests) {
                $tracks[] = [...entry($bests[0], $player), 'track' => $id, 'drivers' => count($bests), 'mine' => placing($bests, $player)];
                foreach ($bests as $index => $row) {
                    $points[$row['player']] ??= ['name' => $row['name'], 'points' => 0, 'records' => 0, 'tracks' => 0, 'time' => 0, 'me' => $row['player'] === $player];
                    $points[$row['player']]['points'] += POINTS[$index] ?? 0;
                    $points[$row['player']]['records'] += $index === 0 ? 1 : 0;
                    $points[$row['player']]['tracks']++;
                    $points[$row['player']]['time'] += (int) $row['time'];
                }
            }
            $overall = array_values($points);
            usort($overall, fn ($a, $b) => [$b['points'], $b['records'], $b['tracks']] <=> [$a['points'], $a['records'], $a['tracks']]);
            reply(['tracks' => $tracks, 'overall' => array_slice($overall, 0, BOARD_SIZE), 'me' => array_values(array_filter($overall, fn ($row) => $row['me']))[0] ?? null]);

        case 'close':
            $room = hostRoom($db, input());
            $db->prepare('DELETE FROM rooms WHERE code = ?')->execute([$room['code']]);
            reply(['ok' => true]);

        default:
            reply(['error' => 'Okänd åtgärd.'], 404);
    }
} catch (Throwable $error) {
    error_log('game-server: ' . $error->getMessage());
    reply(['error' => 'Servern kunde inte svara.'], 500);
}
