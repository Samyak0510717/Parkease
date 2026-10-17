<?php
require __DIR__ . '/../db.php';
require_once __DIR__ . '/../mailer.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

$body = read_json_body();
$zoneId = (int) ($body['zone_id'] ?? 0);
$hours = (int) ($body['hours'] ?? 0);
$token = $body['token'] ?? null;

$requestedSlotId = (int) ($body['slot_id'] ?? $body['slot_number'] ?? 0);

// Payment method — Counter / Cash settlement
$paymentMethod = !empty($body['payment_method']) ? strtolower(trim($body['payment_method'])) : 'counter';
if (!in_array($paymentMethod, ['counter', 'cash', 'qr', 'khalti'])) {
    $paymentMethod = 'counter';
}

// Gmail address for token delivery — required, must be @gmail.com
$rawSendTo = strtolower(trim((string) ($body['send_to_email'] ?? '')));
if (empty($rawSendTo)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'A Gmail address is required to receive your booking token.']);
    exit;
}
if (!filter_var($rawSendTo, FILTER_VALIDATE_EMAIL) || !preg_match('/@gmail\.com$/i', $rawSendTo)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Please enter a valid Gmail address (@gmail.com) for token delivery.']);
    exit;
}

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
    // If rawSendTo is provided and valid, check if user exists in database
    if (!empty($rawSendTo)) {
        $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? AND role = 'driver' LIMIT 1");
        $stmt->execute([$rawSendTo]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
    }
}

if (!$user) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Please sign in or register with your Gmail account to reserve a parking slot and receive your booking token.'
    ]);
    exit;
}

try {
    $pdo->beginTransaction();

    // Re-verify the specific slot server-side with row lock (FOR UPDATE)
    if ($requestedSlotId > 0) {
        $stmt = $pdo->prepare("SELECT slot_id, status FROM slots WHERE slot_id = ? AND zone_id = ? FOR UPDATE");
        $stmt->execute([$requestedSlotId, $zoneId]);
        $slot = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$slot || strtolower($slot['status']) !== 'free') {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'The selected slot is no longer available. Please select another slot.']);
            exit;
        }
    } else {
        // Fallback auto-assign if no slot_id specified
        $stmt = $pdo->prepare("SELECT slot_id, status FROM slots WHERE zone_id = ? AND status = 'free' LIMIT 1 FOR UPDATE");
        $stmt->execute([$zoneId]);
        $slot = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$slot) {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'No free slots left in this zone.']);
            exit;
        }
    }

    $pdo->prepare("UPDATE slots SET status = 'reserved' WHERE slot_id = ?")->execute([$slot['slot_id']]);

    $bookingToken = 'PE-' . random_int(100000, 999999);
    $start = date('Y-m-d H:i:s');
    $end = date('Y-m-d H:i:s', time() + $hours * 3600);

    $stmt = $pdo->prepare('INSERT INTO bookings (user_id, slot_id, start_time, end_time, token) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$user['user_id'], $slot['slot_id'], $start, $end, $bookingToken]);
    $bookingId = $pdo->lastInsertId();

    $pdo->prepare("INSERT INTO payments (booking_id, method, amount, status, paid_at) VALUES (?, ?, ?, 'paid', NOW())")
        ->execute([$bookingId, $paymentMethod, $amount]);

    $pdo->commit();

    // Determine recipient email: user's email from users table or provided input
    $recipientEmail = !empty($user['email']) ? $user['email'] : $rawSendTo;

    // Get zone name
    $zStmt = $pdo->prepare('SELECT zone_name FROM zones WHERE zone_id = ?');
    $zStmt->execute([$zoneId]);
    $zoneName = $zStmt->fetchColumn() ?: "Zone #{$zoneId}";

    // Resolve slot label (e.g. A5, B12) from zone position
    $slotLabel = 'Slot ' . $slot['slot_id'];
    $slStmt = $pdo->prepare(
        'SELECT COUNT(*) FROM slots WHERE zone_id = ? AND slot_id <= ? ORDER BY slot_id'
    );
    $slStmt->execute([$zoneId, $slot['slot_id']]);
    $slotNum = (int) $slStmt->fetchColumn();
    if ($slotNum > 0) {
        $prefix = chr(64 + ((($zoneId - 1) % 26) + 1));
        $slotLabel = $prefix . $slotNum;
    }

    // Send the booking token via PHPMailer / Gmail SMTP (synchronous, in this request)
    $emailSent = false;
    try {
        $emailSent = send_booking_email($recipientEmail, $bookingToken, $zoneName, $slotLabel, (int) $amount, $hours);
    } catch (Throwable $mailEx) {
        error_log("Failed to send booking email: " . $mailEx->getMessage());
    }

    echo json_encode([
        'success'   => true,
        'amount'    => $amount,
        'emailSent' => $emailSent,
        'token'     => $bookingToken,
        'recipient' => $recipientEmail,
    ]);
} catch (Exception $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Booking failed. Please try again.']);
}
