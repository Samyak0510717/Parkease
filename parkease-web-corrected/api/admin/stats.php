<?php
require __DIR__ . '/../../db.php';

$token = $_GET['token'] ?? null;
$admin = require_token($pdo, $token, 'admin');
if (!$admin) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Please sign in again.']);
    exit;
}

$freeSlots = (int) $pdo->query("SELECT COUNT(*) FROM slots WHERE status = 'free'")->fetchColumn();

$revenueToday = (float) $pdo->query(
    "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'paid' AND DATE(paid_at) = CURDATE()"
)->fetchColumn();

$bookingsToday = (int) $pdo->query(
    "SELECT COUNT(*) FROM bookings WHERE DATE(created_at) = CURDATE()"
)->fetchColumn();

echo json_encode(['freeSlots' => $freeSlots, 'revenueToday' => $revenueToday, 'bookingsToday' => $bookingsToday]);
