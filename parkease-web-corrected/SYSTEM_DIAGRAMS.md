# ParkEase — Software Engineering Diagrams & System Models

This document contains the complete set of software engineering diagrams, process models, and project lifecycle charts for the **ParkEase Smart Parking System**. All diagrams are formatted using standard GitHub Flavored Markdown (Mermaid) syntax.

---

## Table of Contents
1. [Iterative Methodology Diagram (SDLC)](#1-iterative-methodology-diagram-sdlc)
2. [Use Case Diagram](#2-use-case-diagram)
3. [Gantt Chart (Project Timeline)](#3-gantt-chart-project-timeline)
4. [Entity Relationship Diagram (ERD)](#4-entity-relationship-diagram-erd)
5. [Context Level Diagram (DFD Level 0)](#5-context-level-diagram-dfd-level-0)
6. [Data Flow Diagram (DFD Level 1)](#6-data-flow-diagram-dfd-level-1)
7. [System Architecture Diagram](#7-system-architecture-diagram)
8. [Interface Structure (Navigation Site Map)](#8-interface-structure-navigation-site-map)

---

## 1. Iterative Methodology Diagram (SDLC)

ParkEase followed an **Iterative & Incremental Agile Development Model**, refining the system through continuous cycles of planning, design, implementation, testing, and feedback.

```mermaid
graph LR
    subgraph Iteration["Iterative Development Cycle"]
        direction TB
        P["1. Requirement Planning & Analysis"]
        D["2. System & UI/UX Design"]
        I["3. Implementation & Coding (PHP/JS/SQL)"]
        T["4. Integration & Functional Testing"]
        R["5. Deployment & Review / Evaluation"]
        
        P --> D
        D --> I
        I --> T
        T --> R
        R -->|Refine & Next Increment| P
    end

    subgraph Increments["Project Deliverables / Iteration Milestones"]
        direction TB
        M1["Iteration 1: Database & Core Auth + OTP System"]
        M2["Iteration 2: Live Slot Status & Interactive Booking Engine"]
        M3["Iteration 3: Khalti Gateway & Email Receipt Integration"]
        M4["Iteration 4: Admin Dashboard, Tariff Controls & Analytics"]
        M5["Iteration 5: End-to-End Testing, Optimization & Final Release"]
    end

    Iteration -.-> Increments
```

---

## 2. Use Case Diagram

Identifies the interactions between the primary actors (**Driver/User**, **Admin**) and external secondary systems (**Khalti Payment Gateway**, **Gmail SMTP Mailer**).

```mermaid
graph LR
    Driver(("👤 Driver / User"))
    Admin(("👨‍💼 System Admin"))
    Khalti["💳 Khalti Gateway"]
    SMTP["📧 Gmail SMTP Server"]

    subgraph ParkEase_System["ParkEase System Boundary"]
        UC1(["Register & Verify OTP"])
        UC2(["Login / Reset Password"])
        UC3(["View Live Slot Status"])
        UC4(["Select Zone & Reserve Slot"])
        UC5(["Pay via Khalti / Counter"])
        UC6(["Receive Booking Email Receipt"])
        UC7(["View Driver Dashboard & History"])
        UC8(["Admin Login & Authentication"])
        UC9(["View System Analytics & Occupancy"])
        UC10(["Manage Dynamic Parking Rates"])
        UC11(["Manage & Cancel Bookings"])
    end

    %% Driver Relationships
    Driver --> UC1
    Driver --> UC2
    Driver --> UC3
    Driver --> UC4
    Driver --> UC5
    Driver --> UC7

    %% External system triggers
    UC1 -.->|Dispatches OTP| SMTP
    UC2 -.->|Dispatches Reset Link/OTP| SMTP
    UC5 <-->|Process Transaction| Khalti
    UC4 -.->|Send Confirmation| UC6
    UC6 -.->|Sends Receipt| SMTP

    %% Admin Relationships
    Admin --> UC8
    Admin --> UC9
    Admin --> UC10
    Admin --> UC11
```

---

## 3. Gantt Chart (Project Timeline)

Detailed project schedule showing phases, task durations, and critical milestones across the development lifecycle.

```mermaid
gantt
    title ParkEase Project Schedule & Milestones
    dateFormat  YYYY-MM-DD
    section Phase 1: Planning & Design
    Requirement Elicitation & Feasibility    :done,    p1_1, 2026-08-01, 7d
    System Architecture & DB Schema Design   :done,    p1_2, after p1_1, 6d
    UI/UX Mockups & Glassmorphism Design     :done,    p1_3, after p1_2, 7d

    section Phase 2: Core Development
    Database Setup & Initial Seeding         :done,    p2_1, after p1_3, 4d
    Authentication & Gmail SMTP OTP Engine   :done,    p2_2, after p2_1, 8d
    Real-time Slot Status & Zone Viewers     :done,    p2_3, after p2_2, 7d
    Booking Engine & Slot Reservation        :done,    p2_4, after p2_3, 8d

    section Phase 3: External Integrations
    Khalti Payment Gateway (v2 API)          :done,    p3_1, after p2_4, 9d
    Automated Email Receipts & Notifications :done,    p3_2, after p3_1, 5d

    section Phase 4: Admin Backoffice
    Admin Auth & Role-based Access Control   :done,    p4_1, after p3_2, 4d
    Analytics Dashboard & Rate Management    :done,    p4_2, after p4_1, 6d

    section Phase 5: Testing & Deployment
    Unit & Integration Testing (API/DB)      :done,    p5_1, after p4_2, 6d
    Performance & Security Audit             :done,    p5_2, after p5_1, 4d
    Final Documentation & Project Release    :active,  p5_3, after p5_2, 3d
```

---

## 4. Entity Relationship Diagram (ERD)

Physical database model highlighting primary keys, foreign keys, cardinality, and data types from `schema.sql`.

```mermaid
erDiagram
    USERS ||--o{ BOOKINGS : "places (1:N)"
    USERS ||--o{ OTP_CODES : "receives (1:N)"
    ZONES ||--|{ SLOTS : "contains (1:N)"
    SLOTS ||--o{ BOOKINGS : "reserved_in (1:N)"
    BOOKINGS ||--|| PAYMENTS : "generates (1:1)"

    USERS {
        int user_id PK
        varchar(15) phone UK
        varchar(150) email UK
        varchar(100) name
        enum role "driver, admin"
        varchar(255) password_hash
        varchar(64) session_token
        datetime created_at
    }

    OTP_CODES {
        int otp_id PK
        varchar(150) email FK
        varchar(6) code
        enum purpose "register, reset_password"
        datetime expires_at
        datetime created_at
    }

    ZONES {
        int zone_id PK
        varchar(100) zone_name
        varchar(150) location
        int total_slots
    }

    SLOTS {
        int slot_id PK
        int zone_id FK
        enum status "free, reserved, occupied"
        decimal hourly_rate
    }

    BOOKINGS {
        int booking_id PK
        int user_id FK
        int slot_id FK
        datetime start_time
        datetime end_time
        varchar(20) token UK
        enum status "active, completed, cancelled"
        datetime created_at
    }

    PAYMENTS {
        int payment_id PK
        int booking_id FK
        varchar(32) method
        decimal amount
        enum status "pending, paid, failed"
        datetime paid_at
    }

    RATES {
        int duration_hours PK
        varchar(30) label
        decimal amount
    }
```

---

## 5. Context Level Diagram (DFD Level 0)

Shows the system boundary, central software package, and high-level input/output flows between external entities.

```mermaid
graph TD
    Driver["👤 Driver / Customer"]
    Admin["👨‍💼 System Administrator"]
    Khalti["💳 Khalti Payment Gateway"]
    SMTP["📧 Gmail SMTP Server"]
    System(("ParkEase Smart Parking System (0.0)"))

    %% Driver flows
    Driver -->|Credentials, OTP Code, Booking Requests, Payment Choice| System
    System -->|Live Slot Availability, Booking Token, Receipt, Dashboard Data| Driver

    %% Admin flows
    Admin -->|Admin Login, Rate Updates, Booking Cancellation Requests| System
    System -->|System Analytics, Occupancy Rates, Booking Logs| Admin

    %% External flows
    System -->|Payment Initiation Payload| Khalti
    Khalti -->|Payment Callback & Verification Status| System

    System -->|Email Body & 6-Digit OTP / Booking Confirmation| SMTP
    SMTP -->|Delivery Status| System
```

---

## 6. Data Flow Diagram (DFD Level 1)

Decomposes the system into functional sub-processes, showing internal data stores.

```mermaid
graph TD
    Driver["👤 Driver"]
    Admin["👨‍💼 Admin"]
    Khalti["💳 Khalti Gateway"]
    SMTP["📧 Gmail SMTP"]

    %% Data Stores
    D1[("D1: Users")]
    D2[("D2: OTP Codes")]
    D3[("D3: Zones & Slots")]
    D4[("D4: Bookings")]
    D5[("D5: Payments")]
    D6[("D6: Rates")]

    %% Processes
    P1(("1.0<br>Auth & OTP Engine"))
    P2(("2.0<br>Slot Query & Availability"))
    P3(("3.0<br>Booking & Reservation"))
    P4(("4.0<br>Payment Processing"))
    P5(("5.0<br>Notification Dispatch"))
    P6(("6.0<br>Admin Control & Analytics"))

    %% Auth Flows
    Driver -->|Signup/Login Data| P1
    P1 <-->|Read/Write User Data| D1
    P1 -->|Store Generated OTP| D2
    P1 -->|Trigger OTP Email| P5

    %% Slot Query Flows
    Driver -->|Select Location / Zone| P2
    P2 <-->|Read Slots & Rates| D3
    P2 <-->|Read Pricing Tiers| D6
    P2 -->|Live Status Matrix| Driver

    %% Booking Flows
    Driver -->|Reserve Slot & Duration| P3
    P3 <-->|Lock Slot / Change Status| D3
    P3 -->|Create Booking Record| D4
    P3 -->|Trigger Payment Record| P4

    %% Payment Flows
    P4 -->|Initiate Khalti Transaction| Khalti
    Khalti -->|Verify Status & PIDX| P4
    P4 -->|Update Payment Status| D5
    P4 -->|Payment Confirmed| P5

    %% Notification Flows
    P5 -->|Send OTP / Booking Receipt| SMTP

    %% Admin Flows
    Admin -->|Login & Configuration| P6
    P6 <-->|Fetch Statistics & Bookings| D4
    P6 <-->|Read & Update Rates| D6
    P6 <-->|Cancel Booking / Release Slot| D3
    P6 -->|Display Metrics & Reports| Admin
```

---

## 7. System Architecture Diagram

Multi-tier modular software architecture outlining the flow from frontend presentation to external microservices.

```mermaid
graph TB
    subgraph Presentation_Layer["Client / Presentation Layer"]
        UI_Home["Landing & Info (index.html)"]
        UI_Slots["Slot Status Board (slot-status.html)"]
        UI_Book["Booking & Checkout (booking.html)"]
        UI_Driver["Driver Portal & History (driver-login/dashboard.html)"]
        UI_Admin["Admin Management Portal (admin-login/dashboard.html)"]
        API_JS["Client API Engine (api.js)"]
        
        UI_Home & UI_Slots & UI_Book & UI_Driver & UI_Admin --> API_JS
    end

    subgraph Backend_Layer["Application & API Layer (PHP 8.x)"]
        Router["HTTP Router / Endpoints"]
        
        subgraph Modules["Functional Services"]
            AuthMod["Authentication & OTP Handler<br>(send-otp.php, user-auth.php)"]
            SlotMod["Slot & Zone Engine<br>(slots.php, slot-status.php)"]
            BookMod["Booking Controller<br>(bookings.php)"]
            PayMod["Khalti Payment Handler<br>(initiate.php, verify.php)"]
            AdminMod["Admin Services & Stats<br>(stats.php, update-rates.php)"]
            MailMod["PHPMailer Service<br>(mailer.php, gmail_otp.php)"]
        end

        DB_Helper["Database Layer (db.php / PDO)"]

        API_JS -->|REST Requests (JSON)| Router
        Router --> AuthMod & SlotMod & BookMod & PayMod & AdminMod
        AuthMod & BookMod --> MailMod
        AuthMod & SlotMod & BookMod & PayMod & AdminMod --> DB_Helper
    end

    subgraph Persistence_Layer["Database Layer (MySQL / MariaDB)"]
        DB[("MySQL Database<br>InnoDB Tables")]
        DB_Helper <-->|Prepared Statements / PDO| DB
    end

    subgraph External_Services["External Services & APIs"]
        Ext_Khalti["Khalti Payment Gateway v2"]
        Ext_SMTP["Google Gmail SMTP Server"]
        
        PayMod <-->|HTTPS cURL (Bearer Auth)| Ext_Khalti
        MailMod -->|SMTP / TLS (Port 587)| Ext_SMTP
    end
```

---

## 8. Interface Structure (Navigation Site Map)

Hierarchical site tree showing screen navigation and sub-component breakdown across driver and administrative portals.

```mermaid
graph TD
    Root["0 — ParkEase (Application Root)"]

    %% Level 1
    P1["1 — Landing Page<br>(index.html)"]
    P2["2 — Live Slot Status<br>(slot-status.html)"]
    P3["3 — Booking & Reservation<br>(booking.html)"]
    P4["4 — Driver Portal<br>(driver-login.html)"]
    P5["5 — Admin Portal<br>(admin-login.html)"]

    Root --> P1
    Root --> P2
    Root --> P3
    Root --> P4
    Root --> P5

    %% Level 2 - Booking
    P3_1["3.1 — Zone & Location Selector"]
    P3_2["3.2 — Duration & Slot Picker"]
    P3_3["3.3 — Payment Options (Khalti / Counter)"]
    P3_4["3.4 — Confirmation & Email Receipt"]
    P3 --> P3_1
    P3 --> P3_2
    P3 --> P3_3
    P3 --> P3_4

    %% Level 2 - Driver Portal
    P4_1["4.1 — Auth & Email OTP Screen"]
    P4_2["4.2 — Driver Dashboard (Active & Past Bookings)"]
    P4 --> P4_1
    P4 --> P4_2

    %% Level 2 - Admin Portal
    P5_1["5.1 — Analytics & Occupancy Overview"]
    P5_2["5.2 — Booking Management & Cancellation"]
    P5_3["5.3 — Dynamic Tariff & Rate Controls"]
    P5 --> P5_1
    P5 --> P5_2
    P5 --> P5_3
```
