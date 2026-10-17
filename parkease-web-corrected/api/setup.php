<?php
// Automatic Database & Admin Setup Script for ParkEase
header('Content-Type: application/json; charset=utf-8');

load_local_env(__DIR__ . '/../.env');

$dbHost = getenv('DB_HOST') ?: '127.0.0.1';
$dbPort = getenv('DB_PORT') ?: '3306';
$dbName = getenv('DB_NAME') ?: 'parkease';
$dbUser = getenv('DB_USER') ?: 'root';
$dbPass = getenv('DB_PASS') ?: '';

function load_local_env($path) {
    if (!is_readable($path)) return;
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || strpos($line, '=') === false) continue;
        [$name, $value] = explode('=', $line, 2);
        if (trim($name) !== '' && getenv(trim($name)) === false) {
            putenv(trim($name) . '=' . trim($value, "\"'"));
        }
    }
}

try {
    // 1. Connect without dbname to create database if not exists
    $pdo = new PDO("mysql:host={$dbHost};port={$dbPort};charset=utf8mb4", $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4");
    $pdo->exec("USE `{$dbName}`");

    // 2. Read schema.sql and execute statements
    $schemaFile = __DIR__ . '/../schema.sql';
    if (!file_exists($schemaFile)) {
        throw new Exception("schema.sql file not found.");
    }

    $sql = file_get_contents($schemaFile);
    $pdo->exec($sql);

    // 3. Ensure admin account exists
    $stmt = $pdo->prepare("SELECT user_id FROM users WHERE email = 'admin@gmail.com' OR phone = '9800000000' LIMIT 1");
    $stmt->execute();
    $existing = $stmt->fetch();

    $hash = password_hash('admin123', PASSWORD_DEFAULT);

    if ($existing) {
        // Update password, email, and role to ensure admin login works 100%
        $stmt = $pdo->prepare("UPDATE users SET email = 'admin@gmail.com', role = 'admin', password_hash = ? WHERE user_id = ?");
        $stmt->execute([$hash, $existing['user_id']]);
    } else {
        $adminPhone = '98' . random_int(10000000, 99999999);
        $stmt = $pdo->prepare("INSERT INTO users (phone, email, name, role, password_hash) VALUES (?, 'admin@gmail.com', 'ParkEase Admin', 'admin', ?)");
        $stmt->execute([$adminPhone, $hash]);
    }

    echo json_encode([
        'success' => true,
        'message' => 'Database setup and admin user creation completed successfully!',
        'admin_credentials' => [
            'email' => 'admin@gmail.com',
            'password' => 'admin123',
            'login_url' => 'http://localhost:8000/admin-login.html'
        ]
    ], JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Setup failed: ' . $e->getMessage(),
        'tip' => 'Make sure MySQL is running in XAMPP and DB_USER/DB_PASS in .env match your MySQL credentials.'
    ], JSON_PRETTY_PRINT);
}
