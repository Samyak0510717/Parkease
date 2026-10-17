<?php
/**
 * Khalti e-Payment v2 — Verify Payment
 *
 * After the user pays on Khalti and is redirected back, the frontend
 * calls this endpoint with the pidx. We verify the payment with Khalti's
 * Lookup API, mark the booking as paid, and send the confirmation email.
 */

require __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../mailer.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

$body = read_json_body();
$pidx         = trim((string) ($body['pidx'] ?? ''));
$bookingToken = trim((string) ($body['booking_token'] ?? ''));

if (empty($pidx)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Missing payment identifier (pidx).']);
    exit;
}

// ── Khalti config ───────────────────────────────────────────────────────────
$khaltiKey  = trim((string) (getenv('KHALTI_SECRET_KEY') ?: ''));
$khaltiEnv  = strtolower(trim((string) (getenv('KHALTI_ENVIRONMENT') ?: 'sandbox')));
$khaltiBase = $khaltiEnv === 'live'
    ? 'https://khalti.com/api/v2'
    : 'https://dev.khalti.com/api/v2';

if (empty($khaltiKey)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Khalti is not configured.']);
    exit;
}

// ── Call Khalti Lookup API ──────────────────────────────────────────────────
$ch = curl_init($khaltiBase . '/epayment/lookup/');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode(['pidx' => $pidx]),
    CURLOPT_HTTPHEADER     => [
        'Authorization: Key ' . $khaltiKey,
        'Content-Type: application/json',
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 15,
    CURLOPT_SSL_VERIFYPEER => true,
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$lookup = json_decode($response, true);

if ($httpCode !== 200 || empty($lookup)) {
    http_response_code(502);
    echo json_encode(['success' => false, 'message' => 'Could not verify payment with Khalti.']);
    exit;
}

$khaltiStatus = $lookup['status'] ?? '';
$khaltiOrderId = $lookup['purchase_order_id'] ?? '';

// Use the purchase_order_id from Khalti (which is our booking token) if not provided
if (empty($bookingToken) && !empty($khaltiOrderId)) {
    $bookingToken = $khaltiOrderId;
}

// Validate that the booking token matches
if (!empty($bookingToken) && !empty($khaltiOrderId) && $bookingToken !== $khaltiOrderId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Booking token mismatch.']);
    exit;
}

// ── Find the booking ────────────────────────────────────────────────────────
$stmt = $pdo->prepare(
    "SELECT b.booking_id, b.user_id, b.slot_id, b.start_time, b.end_time, b.token, b.status AS booking_status,
            p.payment_id, p.amount, p.status AS payment_status,
            u.email, u.name, u.phone,
            z.zone_name, z.zone_id,
            s.slot_id AS s_slot_id
     FROM bookings b
     JOIN payments p ON p.booking_id = b.booking_id
     JOIN users u ON u.user_id = b.user_id
     JOIN slots s ON s.slot_id = b.slot_id
     JOIN zones z ON z.zone_id = s.zone_id
     WHERE b.token = ?
     ORDER BY b.booking_id DESC
     LIMIT 1"
);
$stmt->execute([$bookingToken]);
$booking = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$booking) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Booking not found.']);
    exit;
}

// ── Check Khalti payment status ─────────────────────────────────────────────
if ($khaltiStatus === 'Completed') {
    // Already paid? (idempotent)
    if ($booking['payment_status'] === 'paid') {
        echo json_encode(buildSuccessResponse($booking, true));
        exit;
    }

    // Verify amount matches (Khalti returns paisa, we store NPR)
    $khaltiAmountNpr = ($lookup['total_amount'] ?? 0) / 100;
    if (abs($khaltiAmountNpr - (float) $booking['amount']) > 1) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Payment amount mismatch.']);
        exit;
    }

    // ── Mark payment as paid ────────────────────────────────────────────────
    $pdo->prepare("UPDATE payments SET status = 'paid', paid_at = NOW() WHERE payment_id = ?")
        ->execute([$booking['payment_id']]);

    // ── Send confirmation email ─────────────────────────────────────────────
    $recipientEmail = $booking['email'];
    $zoneName = $booking['zone_name'];
    $hours = max(1, (int) round((strtotime($booking['end_time']) - strtotime($booking['start_time'])) / 3600));

    // Resolve slot label
    $slotLabel = 'Slot ' . $booking['s_slot_id'];
    $slStmt = $pdo->prepare('SELECT COUNT(*) FROM slots WHERE zone_id = ? AND slot_id <= ? ORDER BY slot_id');
    $slStmt->execute([$booking['zone_id'], $booking['s_slot_id']]);
    $slotNum = (int) $slStmt->fetchColumn();
    if ($slotNum > 0) {
        $prefix = chr(64 + ((($booking['zone_id'] - 1) % 26) + 1));
        $slotLabel = $prefix . $slotNum;
    }

    $emailSent = false;
    try {
        $emailSent = send_booking_email(
            $recipientEmail, $bookingToken, $zoneName, $slotLabel,
            (int) $booking['amount'], $hours, 'khalti'
        );
    } catch (Throwable $ex) {
        error_log("Khalti verify — email failed: " . $ex->getMessage());
    }

    echo json_encode(buildSuccessResponse($booking, $emailSent, $slotLabel, $hours));

} elseif (in_array($khaltiStatus, ['Pending', 'Initiated'])) {
    echo json_encode(['success' => false, 'status' => $khaltiStatus, 'message' => 'Payment is still pending. Please complete the payment on Khalti.']);

} else {
    // Failed, Refunded, Expired, User canceled
    // Free the slot and cancel the booking
    $pdo->prepare("UPDATE slots SET status = 'free' WHERE slot_id = ?")->execute([$booking['slot_id']]);
    $pdo->prepare("UPDATE bookings SET status = 'cancelled' WHERE booking_id = ?")->execute([$booking['booking_id']]);
    $pdo->prepare("UPDATE payments SET status = 'failed' WHERE payment_id = ?")->execute([$booking['payment_id']]);

    echo json_encode([
        'success' => false,
        'status'  => $khaltiStatus,
        'message' => 'Payment was not completed. Your slot has been released. Status: ' . $khaltiStatus,
    ]);
}

// ── Helper ──────────────────────────────────────────────────────────────────

function buildSuccessResponse($booking, $emailSent, $slotLabel = null, $hours = null) {
    if (!$slotLabel) $slotLabel = 'Slot ' . $booking['s_slot_id'];
    if (!$hours) $hours = max(1, (int) round((strtotime($booking['end_time']) - strtotime($booking['start_time'])) / 3600));

    return [
        'success'       => true,
        'booking_token' => $booking['token'],
        'emailSent'     => $emailSent,
        'recipient'     => $booking['email'],
        'zone_name'     => $booking['zone_name'],
        'slot_label'    => $slotLabel,
        'hours'         => $hours,
        'amount'        => (float) $booking['amount'],
        'payment_method'=> 'khalti',
    ];
}
