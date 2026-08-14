<?php
require __DIR__ . '/../db.php';

$rows = $pdo->query('SELECT duration_hours AS hours, label, amount AS rate FROM rates ORDER BY duration_hours')
            ->fetchAll(PDO::FETCH_ASSOC);

foreach ($rows as &$r) {
    $r['hours'] = (int) $r['hours'];
    $r['rate'] = (float) $r['rate'];
}

echo json_encode($rows);
