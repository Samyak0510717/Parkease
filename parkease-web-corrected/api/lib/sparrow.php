<?php
/**
 * Sparrow SMS gateway client.
 *
 * The API token is read only from the server environment. This helper is
 * deliberately not exposed directly to the browser.
 */

function send_sparrow_sms($phone, $text) {
    $token = trim((string) (getenv('SPARROW_API_TOKEN') ?: ''));
    $sender = trim((string) (getenv('SPARROW_SENDER_ID') ?: ''));
    $endpoint = trim((string) (getenv('SPARROW_API_URL') ?: 'https://api.sparrowsms.com/v2/sms/'));

    if ($token === '' || $sender === '') {
        return [
            'success' => false,
            'message' => 'Sparrow SMS is not configured.',
        ];
    }

    $normalizedPhone = preg_replace('/\D+/', '', (string) $phone);
    if (strpos($normalizedPhone, '977') === 0 && strlen($normalizedPhone) === 13) {
        $normalizedPhone = substr($normalizedPhone, 3);
    }

    if (!preg_match('/^9[678]\d{8}$/', $normalizedPhone)) {
        return [
            'success' => false,
            'message' => 'The recipient phone number is invalid.',
        ];
    }

    $text = trim((string) $text);
    if ($text === '' || mb_strlen($text) > 1000) {
        return [
            'success' => false,
            'message' => 'The SMS text is invalid.',
        ];
    }

    $curl = curl_init($endpoint);
    if ($curl === false) {
        return [
            'success' => false,
            'message' => 'Could not initialize the Sparrow request.',
        ];
    }

    // This matches Sparrow's documented POST request fields:
    // token, from, to, and text.
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query([
            'token' => $token,
            'from' => $sender,
            'to' => $normalizedPhone,
            'text' => $text,
        ]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);

    $rawResponse = curl_exec($curl);
    $curlError = curl_error($curl);
    $httpStatus = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);

    if ($rawResponse === false) {
        return [
            'success' => false,
            'message' => $curlError !== '' ? 'Sparrow could not be reached.' : 'Sparrow request failed.',
        ];
    }

    $payload = json_decode($rawResponse, true);
    $providerCode = is_array($payload) ? (int) ($payload['response_code'] ?? 0) : 0;
    $providerMessage = is_array($payload) ? trim((string) ($payload['response'] ?? '')) : '';

    if ($httpStatus >= 200 && $httpStatus < 300 && $providerCode === 200) {
        return [
            'success' => true,
            'message' => $providerMessage !== '' ? $providerMessage : 'SMS sent.',
            'response_id' => $payload['response_id'] ?? null,
        ];
    }

    return [
        'success' => false,
        'message' => $providerMessage !== '' ? $providerMessage : 'Sparrow rejected the SMS request.',
    ];
}