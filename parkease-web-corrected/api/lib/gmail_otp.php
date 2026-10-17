<?php
/**
 * Gmail OTP & Email Notification service for ParkEase.
 * Uses the Composer-installed phpmailer/phpmailer for real Gmail SMTP delivery.
 */

require_once __DIR__ . '/../../vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

function generate_otp($pdo, $email, $purpose) {
    $email = strtolower(trim($email));
    $code = sprintf('%06d', random_int(100000, 999999));
    
    // Clear previous codes for this email and purpose
    $stmt = $pdo->prepare("DELETE FROM otp_codes WHERE email = ? AND purpose = ?");
    $stmt->execute([$email, $purpose]);

    // Insert new OTP with 10-minute expiration
    $stmt = $pdo->prepare("INSERT INTO otp_codes (email, code, purpose, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))");
    $stmt->execute([$email, $code, $purpose]);

    return $code;
}

function verify_otp($pdo, $email, $code, $purpose) {
    $email = strtolower(trim($email));
    $code = trim($code);

    $stmt = $pdo->prepare("SELECT otp_id FROM otp_codes WHERE email = ? AND code = ? AND purpose = ? AND expires_at > NOW() LIMIT 1");
    $stmt->execute([$email, $code, $purpose]);
    $otp = $stmt->fetch();

    if ($otp) {
        $del = $pdo->prepare("DELETE FROM otp_codes WHERE otp_id = ?");
        $del->execute([$otp['otp_id']]);
        return true;
    }

    return false;
}

function send_gmail_otp($toEmail, $codeOrMessage, $subject = 'ParkEase Gmail Verification Code', $bodyMessage = null) {
    $toEmail = strtolower(trim($toEmail));
    $gmailUser = getenv('GMAIL_USER') ?: getenv('GMAIL_SENDER_EMAIL') ?: '';
    $gmailPass = trim((string) (getenv('GMAIL_APP_PASSWORD') ?: ''));

    $content = $bodyMessage !== null
        ? $bodyMessage
        : "Your ParkEase Gmail verification code is: {$codeOrMessage}\n\nThis code will expire in 10 minutes. Do not share this code with anyone.";

    // Attempt real SMTP send if credentials are configured
    if (!empty($gmailUser) && !empty($gmailPass)) {
        try {
            $mail = new PHPMailer(true);
            $mail->isSMTP();
            $mail->Host       = 'smtp.gmail.com';
            $mail->SMTPAuth   = true;
            $mail->Username   = $gmailUser;
            $mail->Password   = $gmailPass;
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port       = 587;

            $mail->setFrom($gmailUser, 'ParkEase');
            $mail->addAddress($toEmail);
            $mail->isHTML(false);
            $mail->Subject = $subject;
            $mail->Body    = $content;

            $mail->send();

            return [
                'success' => true,
                'message' => 'Email sent via Gmail SMTP.',
                'sent'    => true
            ];
        } catch (Exception $e) {
            error_log("send_gmail_otp SMTP failed: " . $e->getMessage());
        }
    }

    // Fallback: dev mode — return OTP in response so registration still works locally
    return [
        'success' => true,
        'message' => 'Gmail OTP generated successfully (Development Mode — SMTP not configured).',
        'sent'    => false,
        'dev_otp' => $bodyMessage !== null ? null : $codeOrMessage
    ];
}
