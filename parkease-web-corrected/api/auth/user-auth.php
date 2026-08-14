<?php
require __DIR__ . '/../../db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

$body = read_json_body();
$mode = $body['mode'] ?? 'login';
$email = strtolower(trim($body['email'] ?? ''));
$phone = preg_replace('/\D/', '', $body['phone'] ?? '');
$password = (string) ($body['password'] ?? '');
$name = trim($body['name'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match('/@gmail\.com$/i', $email)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Enter a valid Gmail address.']);
    exit;
}

if ($mode === 'register' && !preg_match('/^(97|98)\d{8}$/', $phone)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Enter a valid 10-digit Nepali mobile number.']);
    exit;
}

if (strlen($password) < 6) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Password must be at least 6 characters.']);
    exit;
}

if ($mode === 'register') {
    if (mb_strlen($name) < 2 || mb_strlen($name) > 100) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Enter your full name.']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT user_id FROM users WHERE (email = ? OR phone = ?) AND role = 'driver' LIMIT 1");
    $stmt->execute([$email, $phone]);
    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'An account already exists for this Gmail or phone number. Please log in.']);
        exit;
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $token = bin2hex(random_bytes(24));
    $stmt = $pdo->prepare("INSERT INTO users (phone, email, name, role, password_hash, session_token) VALUES (?, ?, ?, 'driver', ?, ?)");
    $stmt->execute([$phone, $email, $name, $hash, $token]);
    echo json_encode(['success' => true, 'token' => $token, 'user' => ['phone' => $phone, 'email' => $email, 'name' => $name]]);
    exit;
}

$stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? AND role = 'driver' LIMIT 1");
$stmt->execute([$email]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user || empty($user['password_hash']) || !password_verify($password, $user['password_hash'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Incorrect Gmail address or password.']);
    exit;
}

$token = bin2hex(random_bytes(24));
$pdo->prepare('UPDATE users SET session_token = ? WHERE user_id = ?')->execute([$token, $user['user_id']]);
echo json_encode(['success' => true, 'token' => $token, 'user' => ['phone' => $user['phone'], 'email' => $user['email'], 'name' => $user['name'] ?? '']]);