<?php
require __DIR__ . '/../../db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

$body = read_json_body();
$email = strtolower(trim($body['email'] ?? ''));
$password = $body['password'] ?? '';

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match('/@gmail\.com$/i', $email) || strlen($password) < 6) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Invalid admin ID or password.']);
    exit;
}

$stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? AND role = 'admin'");
$stmt->execute([$email]);
$admin = $stmt->fetch(PDO::FETCH_ASSOC);

// password_verify() checks against the bcrypt hash in password_hash —
// passwords are never stored or compared in plain text.
if (!$admin || !password_verify($password, $admin['password_hash'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Incorrect Gmail address or password.']);
    exit;
}

$token = bin2hex(random_bytes(24));
$pdo->prepare('UPDATE users SET session_token = ? WHERE user_id = ?')->execute([$token, $admin['user_id']]);

echo json_encode(['success' => true, 'token' => $token, 'admin' => ['email' => $email]]);
