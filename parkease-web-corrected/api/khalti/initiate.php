<?php
/**
 * Khalti e-Payment v2 — Initiate Payment
 *
 * Creates a pending booking, reserves the slot, and calls the Khalti
 * initiate API. Returns a payment_url for the frontend to redirect to.
 */

require __DIR__ . '/../../db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

$body = read_json_body();
$zoneId          = (int) ($body['zone_id'] ?? 0);
$hours           = (int) ($body['hours'] ?? 0);
$token           = $body['token'] ?? null;
$requestedSlotId = (int) ($body['slot_id'] ?? $body['slot_number'] ?? 0);
$rawSendTo       = strtolower(trim((string) ($body['send_to_email'] ?? '')));

// ── Validate email ──────────────────────────────────────────────────────────
if (empty($rawSendTo) || !filter_var($rawSendTo, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'A valid email address is required to receive your booking token.']);
    exit;
}

// ── Get rate from database ──────────────────────────────────────────────────
$rateStmt = $pdo->prepare('SELECT amount FROM rates WHERE duration_hours = ?');
$rateStmt->execute([$hours]);
$amount = $rateStmt->fetchColumn();
if ($amount === false) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Invalid duration selected.']);
    exit;
}
$amount = (float) $amount;

// ── Authenticate user ───────────────────────────────────────────────────────
$user = require_token($pdo, $token, 'driver');
if (!$user && !empty($rawSendTo)) {
    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? AND role = 'driver' LIMIT 1");
    $stmt->execute([$rawSendTo]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
}

// Auto-create a guest driver if the email is valid but user doesn't exist yet.
// This lets first-time users pay with Khalti without requiring a separate
// registration step — the account is created on the fly.
if (!$user && !empty($rawSendTo)) {
    $guestPhone = '98' . random_int(10000000, 99999999); // placeholder phone
    $guestName  = explode('@', $rawSendTo)[0];
    $stmt = $pdo->prepare(
        "INSERT INTO users (phone, email, name, role) VALUES (?, ?, ?, 'driver')"
    );
    $stmt->execute([$guestPhone, $rawSendTo, $guestName]);
    $userId = $pdo->lastInsertId();
    $user = ['user_id' => $userId, 'email' => $rawSendTo, 'name' => $guestName, 'phone' => $guestPhone];
}

if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'A valid email is required to proceed with Khalti payment.']);
    exit;
}

// ── Khalti config ───────────────────────────────────────────────────────────
$khaltiKey = trim((string) (getenv('KHALTI_SECRET_KEY') ?: ''));
$khaltiEnv = strtolower(trim((string) (getenv('KHALTI_ENVIRONMENT') ?: 'sandbox')));
$khaltiBase = $khaltiEnv === 'live'
    ? 'https://khalti.com/api/v2'
    : 'https://dev.khalti.com/api/v2';

if (empty($khaltiKey)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Khalti payment gateway is not configured on this server.']);
    exit;
}

// ── Reserve slot & create pending booking ───────────────────────────────────
try {
    $pdo->beginTransaction();

    // Lock the requested slot
    if ($requestedSlotId > 0) {
        $stmt = $pdo->prepare("SELECT slot_id, status FROM slots WHERE slot_id = ? AND zone_id = ? FOR UPDATE");
        $stmt->execute([$requestedSlotId, $zoneId]);
        $slot = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$slot || strtolower($slot['status']) !== 'free') {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'The selected slot is no longer available. Please pick another.']);
            exit;
        }
    } else {
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

    // Reserve the slot
    $pdo->prepare("UPDATE slots SET status = 'reserved' WHERE slot_id = ?")->execute([$slot['slot_id']]);

    // Create booking
    $bookingToken = 'PE-' . random_int(100000, 999999);
    $start = date('Y-m-d H:i:s');
    $end   = date('Y-m-d H:i:s', time() + $hours * 3600);

    $stmt = $pdo->prepare('INSERT INTO bookings (user_id, slot_id, start_time, end_time, token) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$user['user_id'], $slot['slot_id'], $start, $end, $bookingToken]);
    $bookingId = $pdo->lastInsertId();

    // Create a pending payment record
    $pdo->prepare("INSERT INTO payments (booking_id, method, amount, status) VALUES (?, 'khalti', ?, 'pending')")
        ->execute([$bookingId, $amount]);

    $pdo->commit();
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Could not create booking. Please try again.']);
    exit;
}

// ── Build return URL dynamically ────────────────────────────────────────────
$protocol  = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host      = $_SERVER['HTTP_HOST'];
$scriptDir = dirname(dirname(dirname($_SERVER['SCRIPT_NAME'])));  // up from /api/khalti/
$returnUrl  = $protocol . '://' . $host . rtrim($scriptDir, '/\\') . '/booking.html';
$websiteUrl = $protocol . '://' . $host . rtrim($scriptDir, '/\\') . '/';

// ── Call Khalti Initiate API ────────────────────────────────────────────────
$amountInPaisa = (int) ($amount * 100);

$khaltiPayload = [
    'return_url'           => $returnUrl,
    'website_url'          => $websiteUrl,
    'amount'               => $amountInPaisa,
    'purchase_order_id'    => $bookingToken,
    'purchase_order_name'  => 'ParkEase Parking – ' . $bookingToken,
    'customer_info'        => [
        'name'  => $user['name'] ?? 'Driver',
        'email' => $rawSendTo,
        'phone' => $user['phone'] ?? '9800000000',
    ],
];

$ch = curl_init($khaltiBase . '/epayment/initiate/');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($khaltiPayload),
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
$curlErr  = curl_error($ch);
curl_close($ch);

if ($curlErr) {
    // cURL-level failure — undo the booking
    $pdo->prepare("UPDATE slots SET status = 'free' WHERE slot_id = ?")->execute([$slot['slot_id']]);
    $pdo->prepare("UPDATE bookings SET status = 'cancelled' WHERE booking_id = ?")->execute([$bookingId]);
    $pdo->prepare("UPDATE payments SET status = 'failed' WHERE booking_id = ?")->execute([$bookingId]);
    http_response_code(502);
    echo json_encode(['success' => false, 'message' => 'Could not reach Khalti servers. Please try again.']);
    exit;
}

$khaltiResult = json_decode($response, true);

if ($httpCode === 200 && !empty($khaltiResult['payment_url'])) {
    echo json_encode([
        'success'       => true,
        'payment_url'   => $khaltiResult['payment_url'],
        'pidx'          => $khaltiResult['pidx'] ?? '',
        'booking_token' => $bookingToken,
        'amount'        => $amount,
    ]);
} else {
    // Khalti rejected — undo the booking
    $pdo->prepare("UPDATE slots SET status = 'free' WHERE slot_id = ?")->execute([$slot['slot_id']]);
    $pdo->prepare("UPDATE bookings SET status = 'cancelled' WHERE booking_id = ?")->execute([$bookingId]);
    $pdo->prepare("UPDATE payments SET status = 'failed' WHERE booking_id = ?")->execute([$bookingId]);

    $errorMsg = $khaltiResult['detail'] ?? $khaltiResult['message'] ?? 'Khalti payment initiation failed.';
    if (is_array($errorMsg)) $errorMsg = implode(' ', array_map(function ($v) { return is_array($v) ? implode(', ', $v) : $v; }, $errorMsg));
    http_response_code(502);
    echo json_encode(['success' => false, 'message' => $errorMsg, 'khalti_debug' => $khaltiResult]);
}
