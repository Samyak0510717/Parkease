<?php
require __DIR__ . '/../../db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

$body = read_json_body();
$phone = preg_replace('/\D/', '', $body['phone'] ?? '');

if (!preg_match('/^(97|98)\d{8}$/', $phone)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Enter a valid 10-digit Nepali mobile number.']);
    exit;
}

// Do not reveal whether a phone number exists. A production deployment can
// connect this request to its approved support/SMS recovery provider.
$stmt = $pdo->prepare("SELECT user_id FROM users WHERE phone = ? LIMIT 1");
$stmt->execute([$phone]);
$stmt->fetchColumn();

echo json_encode(['success' => true, 'message' => 'If this number is linked to an account, ParkEase support will contact you with the next steps.']);