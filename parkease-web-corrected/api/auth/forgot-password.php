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
$newPassword = (string) ($body['new_password'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match('/@gmail\.com$/i', $email)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Enter a valid Gmail address.']);
    exit;
}

if (empty($code)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Enter the 6-digit Gmail OTP code.']);
    exit;
}

if (strlen($newPassword) < 6) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'New password must be at least 6 characters.']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT user_id FROM users WHERE email = ? LIMIT 1");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'No account found registered with this Gmail address.']);
        exit;
    }

    $verified = verify_otp($pdo, $email, $code, 'reset_password');

    if (!$verified) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired Gmail OTP code. Please check your Gmail or request a new code.']);
        exit;
    }

    $hash = password_hash($newPassword, PASSWORD_DEFAULT);
    $updateStmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE user_id = ?");
    $updateStmt->execute([$hash, $user['user_id']]);

    echo json_encode([
        'success' => true,
        'message' => 'Password reset successfully! You can now log in with your new password.',
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Password reset failed. Please try again.']);
}