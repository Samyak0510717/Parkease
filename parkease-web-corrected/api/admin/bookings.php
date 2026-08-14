<?php
require __DIR__ . '/../../db.php';

$token = $_GET['token'] ?? null;
$admin = require_token($pdo, $token, 'admin');
if (!$admin) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Please sign in again.']);
    exit;
}

$sql = "SELECT b.token AS id, z.zone_name AS zone,
               TIMESTAMPDIFF(HOUR, b.start_time, b.end_time) AS hours,
               p.amount, b.status
        FROM bookings b
        JOIN slots s ON s.slot_id = b.slot_id
        JOIN zones z ON z.zone_id = s.zone_id
        LEFT JOIN payments p ON p.booking_id = b.booking_id
        ORDER BY b.created_at DESC
        LIMIT 20";

$rows = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);

$DURATION_LABELS = [1 => '1 hour', 2 => '2 hours', 4 => '4 hours', 24 => 'Full day'];

$out = array_map(function ($r) use ($DURATION_LABELS) {
    return [
        'id' => $r['id'],
        'zone' => $r['zone'],
        'duration' => $DURATION_LABELS[(int) $r['hours']] ?? $r['hours'] . ' hours',
        'amount' => (float) $r['amount'],
        'status' => ucfirst($r['status']),
    ];
}, $rows);

echo json_encode($out);
