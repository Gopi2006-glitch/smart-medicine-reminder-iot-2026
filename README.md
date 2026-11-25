# SmartMed – Smart Medicine Reminder & IoT Health Monitoring Web Platform

[![Platform](https://img.shields.io/badge/Platform-ESP32%20%2B%20Full--Stack%20Web-blue.svg)]()
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2F%20Express%20%2F%20node%3Asqlite-green.svg)]()
[![Frontend](https://img.shields.io/badge/Frontend-React%20%2F%20Tailwind%20%2F%20Recharts-orange.svg)]()
[![Realtime](https://img.shields.io/badge/Telemetry-WebSockets%20%2B%20REST-purple.svg)]()

A complete, production-grade healthcare IoT web application built for the **SmartMed** intelligent medicine dispenser and physiological vitals station.

---

## 1. System Overview & Key Capabilities

- **Real-Time Biometric Telemetry**: Streams body temperature (TI TMP117) and heart rate / $SpO_2$ (Maxim MAX30102) over high-frequency WebSockets.
- **Automated Dispenser Control**: Manages 3 motorized compartments (Morning, Afternoon, Night) with independent SG90 servo motor angles and acoustic alerts.
- **Ultrasonic Interaction Tracking**: Monitors hand retrieval and fill level via HC-SR04 ultrasonic echo time-of-flight.
- **Embedded SQLite Persistence**: Utilizes Node.js native `node:sqlite` database for storing prescriptions, dispensing history, vitals, and audit logs.
- **Bi-Directional Command Gateway**: Supports manual flap actuation testing, RTC clock synchronization, buzzer test pulses, and schedule updates.
- **Dual Operating Modes**:
  - **Live Hardware Mode**: Listens for live HTTP POST telemetry from the physical ESP32.
  - **Interactive Demo Mode**: Generates realistic biometric fluctuations and events for live academic presentations when physical hardware is offline.

---

## 2. Directory Structure

```
smartmed_web/
│
├── backend/                        # Node.js Express & SQLite Server
│   ├── server.js                   # REST API & WebSocket Telemetry Server
│   ├── db.js                       # SQLite Schema & Automated Seed Engine
│   ├── smartmed.db                 # Persistent SQLite Database File
│   └── public/                     # High-Performance Single-Page App
│       └── index.html              # Complete 8-Page Healthcare Dashboard
│
├── frontend/                       # React 19 + TypeScript + Tailwind Source
│   ├── src/
│   │   ├── components/             # Sidebar, Header, NotificationDrawer, AlertBanner
│   │   ├── pages/                  # All 8 Application Pages
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── HealthMonitoringPage.tsx
│   │   │   ├── MedicineManagementPage.tsx
│   │   │   ├── MedicineInventoryPage.tsx
│   │   │   ├── ReminderHistoryPage.tsx
│   │   │   ├── DeviceControlPage.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   └── AboutProjectPage.tsx
│   │   ├── services/api.ts         # REST Client & WebSocket Handler
│   │   └── types/index.ts          # TypeScript Data Interfaces
│   ├── vite.config.ts
│   └── package.json
│
└── README.md                       # Full-Stack Integration Guide
```

---

## 3. Quick Start & Execution

### Starting the Full-Stack Server
Open PowerShell or Terminal and run:

```bash
cd C:\Users\adari\.gemini\antigravity\scratch\smart_medicine_iot\smartmed_web\backend
node server.js
```

The server initializes the SQLite database, starts the REST API, launches the WebSocket stream on `/ws/telemetry`, and serves the complete 8-page dashboard.

Open your browser to:
👉 **`http://localhost:5000`**

---

## 4. REST API Endpoint Reference

| Endpoint | Method | Description | Example Payload / Query |
| :--- | :--- | :--- | :--- |
| `/api/health/latest` | `GET` | Retrieve latest vitals snapshot | Returns `{ temperature, heart_rate, spo2, status }` |
| `/api/health/history` | `GET` | Historical vitals readings | `?limit=50&date=2026-11-01` |
| `/api/medicines` | `GET` | List all registered prescriptions | Returns array of compartment schedules |
| `/api/medicines` | `POST` | Add a new prescription | `{"name": "Metformin", "dosage": "500mg", "compartment_id": 1, "scheduled_time": "08:00"}` |
| `/api/medicines/:id` | `PUT` | Update existing prescription | `{"dosage": "1000mg"}` |
| `/api/medicines/:id` | `DELETE`| Remove prescription | Deletes record by ID |
| `/api/reminders` | `GET` | Today's reminder summary | Returns completed, pending, missed counts |
| `/api/reminders/acknowledge`| `POST` | Silence alert & close flap | `{"compartment_id": 1, "event_type": "RETRIEVED"}` |
| `/api/device/status` | `GET` | Complete hardware diagnostics | Peripherals, Wi-Fi RSSI, servo states |
| `/api/device/command` | `POST` | Manual hardware test command | `{"command": "TEST_SERVO", "compartment": 1}` |
| `/api/device/telemetry` | `POST` | Primary ESP32 data ingestion | `{"device_id": "SMARTMED_ESP32_01", "temperature": 36.8, "heart_rate": 74, "spo2": 98}` |
| `/api/inventory` | `GET` | Compartment fill levels | Returns estimated stock percentage and depth |
| `/api/inventory/config` | `PUT` | Calibrate ultrasonic range | `{"compartment_id": 1, "full_distance_cm": 3.0, "empty_distance_cm": 15.0}` |
| `/api/notifications` | `GET` | Notification stream | Returns unread count and recent notifications |
| `/api/notifications/clear` | `POST` | Mark all notifications read | Silences unread counter badge |
| `/api/settings` | `GET / PUT`| Patient profile & thresholds | Updates fever, SpO2, and timeout thresholds |
| `/api/mode/toggle` | `POST` | Toggle Live / Demo Mode | Switches between hardware and simulated stream |

---

## 5. ESP32 Hardware Integration Guide

To connect your physical ESP32 to the SmartMed Web Platform:

1. **Find your Computer's Local Network IP**:
   In PowerShell, type `ipconfig`. Note your IPv4 address (e.g. `192.168.1.100`).
2. **Update ESP32 Firmware Configuration**:
   Open `firmware/config.h` (or pass to `cloudSync.begin()` in `main.cpp`):
   ```cpp
   #define SMARTMED_SERVER_URL "http://192.168.1.100:5000"
   ```
3. **Flashing**:
   Upload `firmware/main.cpp` to the ESP32.
4. **Data Transmission Flow**:
   - Every 3 seconds, `ESP32CloudSync::pushTelemetry()` gathers the latest readings from TMP117 and MAX30102 and sends an HTTP `POST` to `/api/device/telemetry`.
   - The server validates physiological bounds, updates the SQLite database, and broadcasts the event over WebSockets to all open browser windows instantly.
   - When an administrator opens a chamber on the web dashboard, the server dispatches the command cleanly (`EXECUTING` when ESP32 is online, `QUEUED` when offline) and the ESP32's polling task actuates the SG90 servo motor on GPIO 32, 26, or 27!

---

## 6. Premium Color Palette & Design System

The platform has been redesigned around an exact 6-color luxury clinical palette:

| Hex Code | Color Name | Role & UI Application |
| :--- | :--- | :--- |
| **`#1A0F2E`** | Deep Midnight Purple | Main sidebar background, primary dark cards, high-contrast typography |
| **`#3B1B4F`** | Dark Plum | Primary navigation active containers, dark sections, section headers |
| **`#7A2E6F`** | Royal Plum | Primary action buttons, active accents, selected controls, primary chart waveforms |
| **`#D6598F`** | Vibrant Rose | Accent icons, highlights, secondary chart trendlines, subtle borders |
| **`#F4D7D4`** | Soft Blush | Card backgrounds, subtle fills, grid lines, diagnostic badges |
| **`#FF6B6B`** | Coral Red | Urgent reminders, critical thresholds, fever alerts, warning indicators |

- **Design Language**: Futuristic, elegant, high-contrast clinical station.
- **Typography**: Clean modern typography using Plus Jakarta Sans & JetBrains Mono.
- **Accessibility**: High contrast guarantees readability (deep purple text on soft blush / neutral cards).

