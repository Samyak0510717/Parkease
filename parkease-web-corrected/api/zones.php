<?php
require __DIR__ . '/../db.php';

    $sql = "SELECT z.zone_id AS id, z.zone_name AS name, z.location AS location, z.total_slots AS totalSlots,
               SUM(CASE WHEN s.status = 'free' THEN 1 ELSE 0 END) AS freeSlots
        FROM zones z
        LEFT JOIN slots s ON s.zone_id = z.zone_id
        GROUP BY z.zone_id";

$rows = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);

foreach ($rows as &$row) {
    $row['id'] = (int) $row['id'];
    $row['totalSlots'] = (int) $row['totalSlots'];
    $row['freeSlots'] = (int) $row['freeSlots'];
}

echo json_encode($rows);
