<?php
require __DIR__ . '/../../db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

$body = read_json_body();
$rawEmail = trim($body['email'] ?? '');
$email = strtolower($rawEmail);

// If user typed 'admin', default to 'admin@gmail.com'
if ($email === 'admin') {
    $email = 'admin@gmail.com';
}

$password = (string) ($body['password'] ?? '');

if (strlen($password) < 6) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Password must be at least 6 characters.']);
    exit;
}

try {
    // Check if user exists by email or default admin phone
    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? OR phone = '9800000000' OR phone = '9899999999' LIMIT 1");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // Auto-create or upgrade default admin account if logging in with default credentials
    if (($email === 'admin@gmail.com' || $email === 'admin') && $password === 'admin123') {
        $hash = password_hash('admin123', PASSWORD_DEFAULT);
        $token = bin2hex(random_bytes(24));

        if (!$user) {
            $adminPhone = '98' . random_int(10000000, 99999999);
            $stmt = $pdo->prepare("INSERT INTO users (phone, email, name, role, password_hash, session_token) VALUES (?, 'admin@gmail.com', 'ParkEase Admin', 'admin', ?, ?)");
            $stmt->execute([$adminPhone, $hash, $token]);
        } else {
            $stmt = $pdo->prepare("UPDATE users SET email = 'admin@gmail.com', role = 'admin', password_hash = ?, session_token = ? WHERE user_id = ?");
            $stmt->execute([$hash, $token, $user['user_id']]);
        }

        echo json_encode(['success' => true, 'token' => $token, 'admin' => ['email' => 'admin@gmail.com']]);
        exit;
    }

    if (!$user || $user['role'] !== 'admin' || !password_verify($password, $user['password_hash'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Incorrect admin email or password.']);
        exit;
    }

    $token = bin2hex(random_bytes(24));
    $pdo->prepare('UPDATE users SET session_token = ? WHERE user_id = ?')->execute([$token, $user['user_id']]);

    echo json_encode(['success' => true, 'token' => $token, 'admin' => ['email' => $email]]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}

