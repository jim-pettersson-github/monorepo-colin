<?php

declare(strict_types=1);

// Room codes for pairing game devices over the internet. The host posts one WebRTC offer at a time, a guest
// claims it with the room code and posts its answer back; the game traffic itself goes directly between devices.

const ROOM_TTL = 12 * 3600;
const CLAIM_TTL = 30;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_SIGNAL = 6000;

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

// TURN relays the game traffic when two networks block direct contact. The relay key stays on the server
// (config.php, written by the deploy workflow); devices get short-lived credentials, cached for a few hours.
function iceServers(PDO $db): array
{
    $config = is_file(__DIR__ . '/config.php') ? require __DIR__ . '/config.php' : [];
    $key = $config['cloudflare_turn_key_id'] ?? '';
    $token = $config['cloudflare_turn_api_token'] ?? '';
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

$action = $_GET['a'] ?? '';
$signal = '/^[A-Za-z0-9._-]{16,' . MAX_SIGNAL . '}$/';

try {
    $db = database();
    $now = time();

    switch ($action) {
        case 'health':
            $count = (int) $db->query('SELECT COUNT(*) FROM rooms WHERE updated > ' . ($now - ROOM_TTL))->fetchColumn();
            $relay = is_file(__DIR__ . '/config.php') && !empty((require __DIR__ . '/config.php')['cloudflare_turn_key_id']);
            reply(['ok' => true, 'php' => PHP_VERSION, 'rooms' => $count, 'relay' => $relay]);

        case 'ice':
            reply(['iceServers' => iceServers($db)]);

        case 'create':
            $body = input();
            $game = text($body, 'game', '/^[a-z0-9-]{2,32}$/');
            $db->prepare('DELETE FROM rooms WHERE updated < ?')->execute([$now - ROOM_TTL]);
            $host = token();
            for ($attempt = 0; $attempt < 20; $attempt++) {
                $code = '';
                for ($i = 0; $i < 4; $i++) $code .= CODE_ALPHABET[random_int(0, strlen(CODE_ALPHABET) - 1)];
                $insert = $db->prepare('INSERT OR IGNORE INTO rooms (code, game, host, updated) VALUES (?, ?, ?, ?)');
                $insert->execute([$code, $game, $host, $now]);
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
            reply(['offer' => $room['offer'], 'claim' => $claim, 'game' => $room['game']]);

        case 'reply':
            $body = input();
            $room = room($db, strtoupper(text($body, 'code', '/^[A-Za-z0-9]{4}$/')));
            $claim = text($body, 'claim', '/^[a-f0-9]{32}$/');
            $update = $db->prepare('UPDATE rooms SET answer = ?, updated = ? WHERE code = ? AND claim = ? AND answer IS NULL AND claimed_at >= ?');
            $update->execute([text($body, 'answer', $signal), $now, $room['code'], $claim, $now - CLAIM_TTL]);
            if ($update->rowCount() !== 1) reply(['error' => 'Inbjudan gick ut. Försök igen.'], 409);
            reply(['ok' => true]);

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
