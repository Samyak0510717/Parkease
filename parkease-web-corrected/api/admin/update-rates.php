<?php
require __DIR__ . '/../../db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

$body = read_json_body();
$token = $body['token'] ?? null;
$rates = $body['rates'] ?? [];

$admin = require_token($pdo, $token, 'admin');
if (!$admin) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Please sign in again.']);
    exit;
}

if (!is_array($rates) || count($rates) === 0) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'No rates provided.']);
    exit;
}

$stmt = $pdo->prepare('UPDATE rates SET amount = ? WHERE duration_hours = ?');

foreach ($rates as $r) {
    $hours = (int) ($r['hours'] ?? 0);
    $amount = (float) ($r['rate'] ?? -1);

    if ($amount < 0) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => "Invalid rate for {$hours}h."]);
        exit;
    }
    $stmt->execute([$amount, $hours]);
}

echo json_encode(['success' => true, 'message' => 'Rates updated.']);
