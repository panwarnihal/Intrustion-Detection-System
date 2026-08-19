# Project Plan: AI-Based Unauthorized Screen Recording & Physical Capture Detection System

## 1. Executive Summary
The **AI-Based Unauthorized Screen Recording & Physical Capture Detection System** is an endpoint security and monitoring tool designed to mitigate digital and visual data exfiltration. The system operates as a hybrid, two-tier architecture comprising a lightweight **FastAPI backend (detection engine)** and a responsive **React (Vite + Tailwind CSS) administrative dashboard**.

The system handles two primary threat vectors:
1. **Software-Based Exfiltration:** Background screen recorders, broadcasting tools, and capture utilities.
2. **Physical Visual Capture:** External smartphone/camera lenses pointed at the screen.

It features a dual-mode enforcement model (Passive Monitoring vs. Active Force-Kill & Blackout), and is optimized to run reliably on standard CPU hardware without requiring dedicated GPUs.

---

## 2. System Architecture

```text
+-----------------------------------------------------------------------+
|                             HOST MACHINE                              |
|                                                                       |
|  +---------------------------+       +-----------------------------+  |
|  |     Process Scanner       |       |       Webcam Vision         |  |
|  |     (psutil Worker)       |       |  (OpenCV + YOLOv8n on CPU)  |  |
|  +-------------+-------------+       +--------------+--------------+  |
|                |                                    |                 |
|                +-----------------+------------------+                 |
|                                  |                                    |
|                                  v                                    |
|                 +--------------------------------+                    |
|                 |    Central Detection Engine    |                    |
|                 |   (Passive vs. Active Logic)   |                    |
|                 +---------------+----------------+                    |
|                                 |                                     |
|               +-----------------+------------------+                  |
|               |                                    |                  |
|               v                                    v                  |
|     +--------------------+              +---------------------+       |
|     |  Enforcement Layer |              |   Forensic Storage  |       |
|     | - Process Kill     |              |   (SQLite Database) |       |
|     | - Tkinter Blackout |              +----------+----------+       |
|     +--------------------+                         |                  |
|                                                    v                  |
|                                         +---------------------+       |
|                                         |   FastAPI Server    |       |
|                                         | (REST & WebSockets) |       |
|                                         +----------+----------+       |
+----------------------------------------------------|------------------+
                                                     | JSON / WS
                                                     v
                                  +------------------------------------+
                                  |         Admin Dashboard            |
                                  |    (React + Vite + Tailwind)       |
                                  |  - Mode Switch (Monitor / Kill)    |
                                  |  - Real-time Alert Telemetry       |
                                  |  - Incident Audit Trail Table      |
                                  +------------------------------------+
```

---

## 3. Core Modules & Technical Specifications

### Module 1: Process Monitoring Agent (Software Layer)
* **Technology:** Python `psutil`
* **Execution Interval:** Every 2.0 seconds.
* **Target Signatures:** `obs64.exe`, `obs32.exe`, `SnippingTool.exe`, `ScreenClippingHost.exe`, `ShareX.exe`, `camtasia.exe`, `bdcam.exe`, `fraps.exe`, `screenflow`, `quicktime`.
* **Behavior:**
  * Iterates over running processes and inspects binary names and command lines.
  * If a match is found:
    * In **Passive Mode**: Logs incident and sends a WebSocket alert.
    * In **Active Mode**: Dispatches `process.kill()`, logs incident as "Process Killed", and alerts the dashboard.

### Module 2: Webcam Physical Capture Detector (Visual Layer)
* **Technology:** `opencv-python`, `ultralytics` (`yolov8n.pt`).
* **CPU Optimization Profile:**
  * Explicitly configured with `device='cpu'`.
  * Input frames downscaled to `480x360` resolution.
  * Frame-skipping mechanism: Inference runs on 1 frame out of every 4 captured.
* **Detection Target:** COCO Dataset Class `67` (`cell phone`) with a confidence threshold $\ge 0.50$.
* **Behavior:**
  * In **Passive Mode**: Flags presence of recording device and broadcasts alert.
  * In **Active Mode**: Triggers the OS-level Screen Blackout Controller.

### Module 3: Enforcement & Screen Blackout Controller (Defense Layer)
* **Technology:** Python `tkinter` (headless/overlay daemon).
* **Behavior:**
  * Upon receiving a physical capture signal in **Active Mode**, initializes a borderless, always-on-top, fullscreen black canvas (`#000000`) with high-visibility warning text.
  * Automatically releases and destroys the overlay once the physical recording device leaves the webcam's field of view for $> 2.0$ seconds.

### Module 4: Persistence & Storage (Forensic Layer)
* **Technology:** SQLite3 (`incidents.db`).
* **Database Schema:**
  * `logs`:
    * `id` (INTEGER, Primary Key, Auto-increment)
    * `timestamp` (TEXT, ISO-8601)
    * `threat_category` (TEXT - `Screen Recorder` | `Physical Device`)
    * `target_detail` (TEXT - e.g., Process Name, PID, or Detection Confidence)
    * `action_taken` (TEXT - `Logged` | `Process Killed` | `Screen Blocked`)
  * `settings`:
    * `key` (TEXT, Primary Key)
    * `value` (INTEGER - `0` for Passive, `1` for Active)

### Module 5: Administrative Control Plane (Frontend Layer)
* **Technology:** React 18, Vite, Tailwind CSS, Lucide React (Icons).
* **Key Features:**
  * **Master Toggle:** Dual-state switch triggering `POST /api/toggle-mode`.
  * **Status Indicators:** Live cards displaying Backend Connection, Process Scanner status, and Webcam Monitor status.
  * **Live Incident Feed:** Real-time event consumption via `WebSocket /ws/alerts`.
  * **Audit Log Viewer:** Sortable, filterable incident table backed by `GET /api/logs` with Clear/Export capabilities.

---

## 4. API & WebSocket Specification

### REST Endpoints
| Method | Endpoint | Description | Payload / Response |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/mode` | Fetch current enforcement state | `{"active_mode": 0 \| 1}` |
| `POST` | `/api/toggle-mode` | Switch Active/Passive mode | `{"active_mode": 0 \| 1}` $\rightarrow$ `{"status": "success", "active_mode": 0 \| 1}` |
| `GET` | `/api/logs` | Fetch incident history | `[{"id": 1, "timestamp": "...", "threat_category": "...", ...}]` |
| `POST` | `/api/clear-logs` | Wipe forensic logs | `{"status": "cleared"}` |

### WebSocket Protocol
* **Endpoint:** `ws://localhost:8000/ws/alerts`
* **Event Payload Structure:**
```json
{
  "type": "THREAT_DETECTED",
  "data": {
    "timestamp": "2026-08-19T12:30:00.000000",
    "threat_category": "Physical Device",
    "target_detail": "Cell Phone (Confidence: 0.84)",
    "action_taken": "Screen Blocked",
    "active_mode": 1
  }
}
```

---

## 5. Implementation Roadmap

### Phase 1: Environment & Persistence Setup

* [ ] Create repository workspace structure (`/backend`, `/frontend`).
* [ ] Initialize Python virtual environment and install dependencies (`fastapi`, `uvicorn`, `psutil`, `opencv-python`, `ultralytics`, `pydantic`).
* [ ] Implement `backend/database.py` with SQLite table definitions and CRUD operations.

### Phase 2: Detection Workers & Background Daemons

* [ ] Develop `backend/detector.py`:
  * [ ] Implement `ProcessScannerThread` using `psutil`.
  * [ ] Implement `WebcamScannerThread` using OpenCV, frame-skipping, and CPU-forced YOLOv8n.
  * [ ] Implement `ScreenBlackoutController` with Tkinter.
  * [ ] Implement thread-safe communication and shared state synchronization.

### Phase 3: FastAPI Gateway & WebSockets

* [ ] Develop `backend/main.py`:
  * [ ] Configure FastAPI app and CORS middleware.
  * [ ] Implement REST endpoints (`/api/mode`, `/api/toggle-mode`, `/api/logs`, `/api/clear-logs`).
  * [ ] Implement WebSocket connection manager and broadcast mechanism.
  * [ ] Bind lifespan context manager to launch/terminate background threads cleanly.

### Phase 4: React Dashboard Implementation

* [ ] Scaffold frontend project with Vite (`npm create vite@latest frontend -- --template react`).
* [ ] Configure Tailwind CSS and Lucide icons.
* [ ] Build UI Components:
  * [ ] Top navigation bar with status badges.
  * [ ] Master Mode Toggle component.
  * [ ] Live Incident Log Table with color-coded severity.
  * [ ] Log action toolbar (Refresh, Clear, Export to JSON).
  * [ ] Integrate React state with REST API and WebSocket events.

### Phase 5: Testing, Benchmarking & Presentation Prep

* [ ] Verify CPU resource utilization on low-spec hardware (target: $< 25\%$ CPU load).
* [ ] Conduct end-to-end enforcement tests for both Passive and Active modes.
* [ ] Write `README.md` with complete installation and demonstration scripts.

---

## 6. Verification & Demonstration Playbook

To validate the system during evaluation or live demonstration:

1. **Passive Mode Validation:**
   * Set toggle to **Passive Mode** on the dashboard.
   * Open `Snipping Tool` or start an unapproved screen recording app.
   * **Expected Outcome:** The dashboard immediately receives a red alert entry, the event is saved to SQLite, but the recording tool is **not** terminated.

2. **Active Mode Process Kill Validation:**
   * Switch toggle to **Active Mode**.
   * Launch `Snipping Tool` or `OBS Studio`.
   * **Expected Outcome:** The backend kills the process within 2 seconds, and the log reflects `Action Taken: Process Killed`.

3. **Physical Capture & Blackout Validation:**
   * Keep system in **Active Mode**.
   * Hold a smartphone up to the webcam.
   * **Expected Outcome:** The screen instantly blacks out with a security overlay. Lowering the phone restores the screen within 2 seconds.