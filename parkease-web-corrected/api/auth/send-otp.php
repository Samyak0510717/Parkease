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
$purpose = trim($body['purpose'] ?? 'register');

if (!in_array($purpose, ['register', 'reset_password'], true)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Invalid OTP purpose.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match('/@gmail\.com$/i', $email)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Enter a valid Gmail address (must end with @gmail.com).']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT user_id FROM users WHERE email = ? LIMIT 1");
    $stmt->execute([$email]);
    $userExists = (bool) $stmt->fetch();

    if ($purpose === 'register' && $userExists) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'An account already exists for this Gmail address. Please log in.']);
        exit;
    }

    if ($purpose === 'reset_password' && !$userExists) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'No ParkEase account is registered with this Gmail address.']);
        exit;
    }

    $code = generate_otp($pdo, $email, $purpose);
    $sendResult = send_gmail_otp($email, $code);

    $response = [
        'success' => true,
        'message' => "A 6-digit verification OTP code has been sent to {$email}.",
    ];

    if (!empty($sendResult['dev_otp'])) {
        $response['dev_otp'] = $sendResult['dev_otp'];
        $response['message'] .= " (Dev OTP: {$sendResult['dev_otp']})";
    }

    echo json_encode($response);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to generate OTP code. Please try again.']);
}
