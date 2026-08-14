<?php
require __DIR__ . '/../db.php';

try {
    $pdo->query('SELECT 1');
    echo json_encode([
        'success' => true,
        'database' => 'connected',
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'database' => 'unavailable',
    ]);
}