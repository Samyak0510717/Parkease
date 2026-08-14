<?php
// Shared MySQL connection. Configure these values as environment variables;
// never commit a real database password into this file.

header('Content-Type: application/json; charset=utf-8');

// For local PHP runs, load a project .env file when one exists. Hosted
// environments should provide the same values through their environment
// settings instead of uploading a .env file.
function load_local_env($path) {
    if (!is_readable($path)) {
        return;
    }

    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || strpos($line, '=') === false) {
            continue;
        }

        [$name, $value] = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value);
        if ($name !== '' && getenv($name) === false) {
            putenv($name . '=' . trim($value, "\"'"));
        }
    }
}

load_local_env(__DIR__ . '/.env');

$dbHost = getenv('DB_HOST') ?: '127.0.0.1';
$dbPort = getenv('DB_PORT') ?: '3306';
$dbName = getenv('DB_NAME') ?: 'parkease';
$dbUser = getenv('DB_USER') ?: 'root';
$dbPass = getenv('DB_PASS') ?: '';

try {
    $pdo = new PDO(
        "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4",
        $dbUser,
        $dbPass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
} catch (PDOException $e) {
    // Keep credentials and internal connection details out of the response.
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
    exit;
}

// Reads and decodes a JSON request body into an assoc array.
function read_json_body() {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?: [];
}

// Verifies a bearer-style token exists on the request and maps it back to
// a user. A real production system should use signed tokens (e.g. JWT)
// with expiry, rather than a raw session lookup like this.
function require_token($pdo, $token, $role = null) {
    if (!$token) return null;
    $sql = "SELECT * FROM users WHERE session_token = ?";
    if ($role) $sql .= " AND role = " . $pdo->quote($role);
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$token]);
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}
