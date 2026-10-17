<?php
require __DIR__ . '/../../db.php';

$token = $_GET['token'] ?? null;
if (!$token && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = read_json_body();
    $token = $body['token'] ?? null;
}

if (!$token) {
    // Check Authorization header
    $headers = getallheaders();
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (preg_match('/Bearer\s+(\S+)/i', $auth, $m)) {
        $token = $m[1];
    }
}

$user = require_token($pdo, $token, 'driver');

if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthenticated or expired session.']);
    exit;
}

echo json_encode([
    'success' => true,
    'user' => [
        'id'    => (int) $user['user_id'],
        'name'  => $user['name'],
        'email' => $user['email'],
        'phone' => $user['phone'] ?? '',
        'role'  => $user['role'],
    ],
]);
