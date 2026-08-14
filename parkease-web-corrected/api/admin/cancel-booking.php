<?php
require __DIR__ . '/../../db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

$body = read_json_body();
$token = $body['token'] ?? null;
$bookingToken = trim($body['booking_token'] ?? '');

$admin = require_token($pdo, $token, 'admin');
if (!$admin) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Please sign in again.']);
    exit;
}

if (!$bookingToken) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'No booking specified.']);
    exit;
}

// This is a SOFT delete: the booking row stays (status -> 'cancelled') so
// there's still a revenue/audit trail. A hard DELETE would erase the
// record entirely, which you generally don't want for financial data.
try {
    $pdo->beginTransaction();

    $stmt = $pdo->prepare("SELECT booking_id, slot_id, status FROM bookings WHERE token = ? FOR UPDATE");
    $stmt->execute([$bookingToken]);
    $booking = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$booking) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Booking not found.']);
        exit;
    }
    if ($booking['status'] !== 'active') {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Only active bookings can be cancelled.']);
        exit;
    }

    $pdo->prepare("UPDATE bookings SET status = 'cancelled' WHERE booking_id = ?")
        ->execute([$booking['booking_id']]);
    $pdo->prepare("UPDATE slots SET status = 'free' WHERE slot_id = ?")
        ->execute([$booking['slot_id']]);

    $pdo->commit();
    echo json_encode(['success' => true, 'message' => 'Booking cancelled.']);
} catch (Exception $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Could not cancel booking.']);
}
