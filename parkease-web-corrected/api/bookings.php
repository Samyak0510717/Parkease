<?php
require __DIR__ . '/../db.php';
require_once __DIR__ . '/lib/sparrow.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

$body = read_json_body();
$zoneId = (int) ($body['zone_id'] ?? 0);
$hours = (int) ($body['hours'] ?? 0);
$token = $body['token'] ?? null;

// Price comes from the database now, not a hardcoded array — this is
// what makes the admin dashboard's rate editor actually mean something.
// Still validated server-side, so a manipulated client request can't
// set its own price.
$rateStmt = $pdo->prepare('SELECT amount FROM rates WHERE duration_hours = ?');
$rateStmt->execute([$hours]);
$amount = $rateStmt->fetchColumn();

if ($amount === false) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Invalid duration.']);
    exit;
}
$amount = (float) $amount;

$user = require_token($pdo, $token, 'driver');
if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Please sign in again.']);
    exit;
}

try {
    $pdo->beginTransaction();

    // Lock a free slot in this zone so two simultaneous bookings can't grab the same one
    $stmt = $pdo->prepare("SELECT slot_id FROM slots WHERE zone_id = ? AND status = 'free' LIMIT 1 FOR UPDATE");
    $stmt->execute([$zoneId]);
    $slot = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$slot) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'No free slots left in this zone.']);
        exit;
    }

    $pdo->prepare("UPDATE slots SET status = 'reserved' WHERE slot_id = ?")->execute([$slot['slot_id']]);

    $bookingToken = 'PE-' . random_int(100000, 999999);
    $start = date('Y-m-d H:i:s');
    $end = date('Y-m-d H:i:s', time() + $hours * 3600);

    $stmt = $pdo->prepare('INSERT INTO bookings (user_id, slot_id, start_time, end_time, token) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$user['user_id'], $slot['slot_id'], $start, $end, $bookingToken]);
    $bookingId = $pdo->lastInsertId();

    $pdo->prepare("INSERT INTO payments (booking_id, method, amount, status, paid_at) VALUES (?, 'khalti', ?, 'paid', NOW())")
        ->execute([$bookingId, $amount]);

    $pdo->commit();

    $sms = send_sparrow_sms(
        $user['phone'],
        "ParkEase booking {$bookingToken} confirmed. Show this token at the parking entry."
    );

    echo json_encode([
        'success' => true,
        'bookingToken' => $bookingToken,
        'amount' => $amount,
        'smsSent' => $sms['success'],
        'smsMessage' => $sms['success'] ? null : 'Booking confirmed, but the SMS could not be sent right now.',
    ]);
} catch (Exception $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Booking failed. Please try again.']);
}
