-- ParkEase database schema for a Nepal-focused smart parking system

CREATE DATABASE IF NOT EXISTS parkease CHARACTER SET utf8mb4;
USE parkease;

CREATE TABLE users (
  user_id       INT AUTO_INCREMENT PRIMARY KEY,
  phone         VARCHAR(15) NOT NULL UNIQUE,
  email         VARCHAR(150) DEFAULT NULL UNIQUE,
  name          VARCHAR(100) DEFAULT NULL,
  role          ENUM('driver','admin') NOT NULL DEFAULT 'driver',
  password_hash VARCHAR(255) DEFAULT NULL,
  session_token VARCHAR(64) DEFAULT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE zones (
  zone_id     INT AUTO_INCREMENT PRIMARY KEY,
  zone_name   VARCHAR(100) NOT NULL,
  location    VARCHAR(150) DEFAULT NULL,
  total_slots INT NOT NULL DEFAULT 0
);

CREATE TABLE slots (
  slot_id     INT AUTO_INCREMENT PRIMARY KEY,
  zone_id     INT NOT NULL,
  status      ENUM('free','reserved','occupied') NOT NULL DEFAULT 'free',
  hourly_rate DECIMAL(8,2) NOT NULL DEFAULT 40.00,
  FOREIGN KEY (zone_id) REFERENCES zones(zone_id) ON DELETE CASCADE
);

CREATE TABLE bookings (
  booking_id  INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  slot_id     INT NOT NULL,
  start_time  DATETIME NOT NULL,
  end_time    DATETIME NOT NULL,
  token       VARCHAR(20) NOT NULL UNIQUE,
  status      ENUM('active','completed','cancelled') NOT NULL DEFAULT 'active',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (slot_id) REFERENCES slots(slot_id)
);

CREATE TABLE payments (
  payment_id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  method     ENUM('khalti','esewa','cash') NOT NULL,
  amount     DECIMAL(8,2) NOT NULL,
  status     ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending',
  paid_at    DATETIME DEFAULT NULL,
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
);

CREATE TABLE rates (
  duration_hours INT PRIMARY KEY,
  label          VARCHAR(30) NOT NULL,
  amount         DECIMAL(8,2) NOT NULL
);

INSERT INTO zones (zone_name, location, total_slots) VALUES
  ('New Road', 'Kathmandu', 40),
  ('Khusibu', 'Kathmandu', 20),
  ('Baneshwor', 'Kathmandu', 50),
  ('Patan Durbar', 'Lalitpur', 15);

-- Seed the individual slots represented by each zone. The original archive
-- created zones but not slots, which made every zone appear empty.
CREATE TEMPORARY TABLE seed_numbers (n INT PRIMARY KEY);
INSERT INTO seed_numbers (n) VALUES
  (1),(2),(3),(4),(5),(6),(7),(8),(9),(10),
  (11),(12),(13),(14),(15),(16),(17),(18),(19),(20),
  (21),(22),(23),(24),(25),(26),(27),(28),(29),(30),
  (31),(32),(33),(34),(35),(36),(37),(38),(39),(40),
  (41),(42),(43),(44),(45),(46),(47),(48),(49),(50);

INSERT INTO slots (zone_id)
SELECT z.zone_id
FROM zones AS z
JOIN seed_numbers AS n
  ON n.n <= CASE z.zone_name
    WHEN 'New Road' THEN 40
    WHEN 'Khusibu' THEN 20
    WHEN 'Baneshwor' THEN 50
    WHEN 'Patan Durbar' THEN 15
    ELSE 0
  END;

DROP TEMPORARY TABLE seed_numbers;

INSERT INTO rates (duration_hours, label, amount) VALUES
  (1, '1 hour', 40.00),
  (2, '2 hours', 70.00),
  (4, '4 hours', 120.00),
  (24, 'Full day', 250.00);