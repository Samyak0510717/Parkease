<?php
require __DIR__ . '/../../db.php';
require_once __DIR__ . '/../lib/gmail_otp.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

$body = read_json_body();
$email = strtolower(trim($body['email'] ?? ''));
$code = trim($body['code'] ?? '');
$purpose = trim($body['purpose'] ?? 'register');

if (empty($email) || empty($code)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Gmail address and 6-digit OTP code are required.']);
    exit;
}

try {
    $verified = verify_otp($pdo, $email, $code, $purpose);

    if (!$verified) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired Gmail OTP code. Please check your Gmail inbox or request a new code.']);
        exit;
    }

    echo json_encode([
        'success' => true,
        'message' => 'Gmail address verified successfully.',
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'OTP verification failed. Please try again.']);
}
