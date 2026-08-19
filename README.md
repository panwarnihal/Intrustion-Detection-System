# 🛡️ OmniGuard — AI-Based Unauthorized Screen Recording Detection System

A lightweight, two-tier cybersecurity endpoint protection tool that prevents unauthorized data capture by combining **real-time OS process scanning** with **AI-powered physical device detection** (YOLOv8). The system runs entirely on CPU — no dedicated GPU or CUDA installation required.

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Hardware Requirements](#-hardware-requirements)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Quickstart Guide](#-quickstart-guide)
- [Demo & Testing Instructions](#-demo--testing-instructions)
- [API Reference](#-api-reference)
- [License](#-license)

---

## 🔍 Project Overview

Modern workplaces and examination environments face a growing threat from unauthorized screen capture — both through **software-based screen recorders** (OBS Studio, Snipping Tool, ShareX) and **physical recording devices** (smartphones pointed at a monitor).

**OmniGuard** addresses both vectors simultaneously:

| Tier | Detection Method | Technology |
|------|-----------------|------------|
| **Tier 1 — Software** | Scans all running OS processes every 2 seconds for known screen-recording signatures | `psutil` (Python) |
| **Tier 2 — Physical** | Captures the webcam feed and runs YOLOv8 Nano object detection to identify cell phones in frame | `OpenCV` + `Ultralytics YOLOv8n` |

A **React dashboard** provides real-time visibility into all detections and lets an operator switch between two enforcement policies:

- **Passive Mode (Monitor Only)** — Detects and logs threats; broadcasts alerts to the dashboard. No processes are terminated.
- **Active Mode (Force Kill)** — Detects, logs, alerts, **and** immediately kills offending processes or triggers a full-screen blackout overlay when a phone is detected.

---

## ✨ Key Features

- ⚡ **Real-Time Process Scanning** — Background thread checks all OS processes every 2 seconds against a configurable blocklist of screen recorders.
- 📷 **AI Smartphone Detection** — YOLOv8 Nano runs on CPU with frame-skipping (1 in 4 frames) and 480×360 downscaling to remain lightweight on any machine.
- 🔁 **Live Toggle** — Switch between Passive and Active enforcement instantly from the dashboard; the backend responds in real time.
- 🖥️ **Screen Blackout** — In Active Mode, physical device detection triggers a fullscreen Tkinter overlay that blacks out the entire screen until the threat is removed.
- 📡 **WebSocket Telemetry** — All threat events and system status updates stream to the dashboard in real time via WebSocket.
- 📊 **Incident Audit Log** — Every detection is recorded in a local SQLite database with timestamp, threat category, target detail, and action taken.
- 📥 **Export & Clear** — Download the full incident history as a JSON file or wipe the database from the dashboard.
- 🔊 **Audio Alerts** — The dashboard plays a Web Audio API double-beep tone on every new threat detection.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  React Dashboard (Vite)                 │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Mode Toggle│  │ Incident Log │  │ System Status  │  │
│  └─────┬──────┘  └──────┬───────┘  └───────┬────────┘  │
│        │ POST           │ GET              │ WebSocket  │
└────────┼────────────────┼──────────────────┼────────────┘
         │                │                  │
    ┌────▼────────────────▼──────────────────▼────────────┐
    │              FastAPI Server (:8000)                  │
    │  ┌──────────────────────────────────────────────┐   │
    │  │         WebSocket Connection Manager          │   │
    │  └──────────────────────────────────────────────┘   │
    │  ┌─────────────────┐  ┌──────────────────────────┐  │
    │  │  Thread A        │  │  Thread B                │  │
    │  │  Process Scanner │  │  Webcam + YOLOv8n (CPU)  │  │
    │  │  (psutil, 2s)    │  │  (frame-skip, 480×360)   │  │
    │  └────────┬─────────┘  └────────────┬─────────────┘  │
    │           │                         │                │
    │     ┌─────▼─────────────────────────▼──────────┐     │
    │     │          SQLite Database                  │     │
    │     │   logs | settings (active_mode)           │     │
    │     └──────────────────────────────────────────┘     │
    └──────────────────────────────────────────────────────┘
```

---

## 💻 Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **CPU** | Any modern dual-core (Intel i3 / Ryzen 3) | Quad-core (Intel i5 / Ryzen 5) |
| **RAM** | 4 GB | 8 GB |
| **GPU** | **Not required** — YOLOv8 runs on CPU | — |
| **Webcam** | Any USB or integrated webcam | 720p+ for better detection |
| **OS** | Windows 10/11 | Windows 11 |
| **CUDA** | **Not required** | — |

> **Note:** The system is explicitly configured with `device='cpu'` for all inference. No NVIDIA drivers, CUDA toolkit, or cuDNN installation is needed.

---

## 🧰 Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Backend** | Python 3.10+, FastAPI, Uvicorn, SQLite3, psutil, OpenCV, Ultralytics YOLOv8 |
| **Frontend** | React 19, Vite, Tailwind CSS v4, Lucide React Icons |
| **Communication** | REST API + WebSocket (real-time alerts) |

---

## 📁 Project Structure

```
Intrustion-Detection-System/
├── backend/
│   ├── __init__.py          # Python package marker
│   ├── blackout.py          # Tkinter fullscreen blackout overlay
│   ├── database.py          # SQLite schema, CRUD, settings management
│   ├── detector.py          # Background threads: process scanner + webcam AI
│   ├── main.py              # FastAPI app, REST endpoints, WebSocket router
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── public/              # Static assets
│   ├── src/
│   │   ├── App.jsx          # Main dashboard UI component
│   │   ├── index.css        # Tailwind + custom glassmorphism styles
│   │   └── main.jsx         # React entry point
│   ├── index.html           # HTML shell
│   ├── package.json         # Node dependencies
│   └── vite.config.js       # Vite + Tailwind v4 plugin config
├── .venv/                   # Python virtual environment (local, gitignored)
└── README.md                # This file
```

---

## 🚀 Quickstart Guide

### Prerequisites

- **Python 3.10+** — [Download](https://www.python.org/downloads/)
- **Node.js 18+** and **npm** — [Download](https://nodejs.org/)
- **Git** — [Download](https://git-scm.com/)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/Intrustion-Detection-System.git
cd Intrustion-Detection-System
```

### 2. Set Up the Backend

```bash
# Create a Python virtual environment
python -m venv .venv

# Activate it
# On Windows (PowerShell):
.venv\Scripts\Activate.ps1
# On Windows (CMD):
.venv\Scripts\activate.bat

# Install Python dependencies
pip install -r backend/requirements.txt
```

> ℹ️ The first run will automatically download the `yolov8n.pt` model file (~6 MB). This is a one-time download.

### 3. Set Up the Frontend

```bash
cd frontend
npm install
cd ..
```

### 4. Start Both Servers

Open **two separate terminal windows**, both from the project root:

**Terminal 1 — Backend (FastAPI on port 8000):**
```bash
# Activate venv first
.venv\Scripts\Activate.ps1

# Start the server
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 — Frontend (Vite dev server on port 5173):**
```bash
cd frontend
npm run dev
```

### 5. Open the Dashboard

Navigate to **[http://localhost:5173](http://localhost:5173)** in your browser.

The dashboard will automatically connect to the backend WebSocket at `ws://localhost:8000/ws/alerts` and begin displaying live system status.

---

## 🧪 Demo & Testing Instructions

Use these steps for a live presentation or evaluation:

### Test 1: Software Threat Detection (Passive Mode)

1. Ensure the dashboard toggle is set to **PASSIVE MONITOR** (green).
2. Open **Snipping Tool** on Windows (`Win + Shift + S` or search for "Snipping Tool").
3. **Expected Result:** Within 2 seconds, the dashboard shows a new incident:
   - Category: `Screen Recorder`
   - Detail: `SnippingTool.exe (PID: xxxx)`
   - Action: `Logged (Passive Monitor)`
4. The Snipping Tool **remains open** — it is not terminated.

### Test 2: Software Threat Detection (Active Mode)

1. Switch the dashboard toggle to **ACTIVE FORCE-KILL** (red).
2. Open **Snipping Tool** again.
3. **Expected Result:** The incident appears in the log with:
   - Action: `Terminated (Active Kill)`
4. The Snipping Tool window **closes immediately** — the process was force-killed by the system.

### Test 3: Physical Device Detection (Passive Mode)

1. Switch back to **PASSIVE MONITOR**.
2. Point a **cell phone** at your webcam so it is clearly visible in frame.
3. **Expected Result:** The dashboard logs:
   - Category: `Physical Device`
   - Detail: `Cell Phone detected in camera frame`
   - Action: `Logged (Passive Monitor)`
4. Remove the phone. After a few seconds the log shows: `Cell Phone threat cleared`.

### Test 4: Physical Device Detection (Active Mode)

1. Switch to **ACTIVE FORCE-KILL**.
2. Point a cell phone at the webcam.
3. **Expected Result:**
   - The incident is logged with Action: `Blocked Screen`.
   - A **fullscreen black overlay** appears covering the entire screen with the message:
     _"UNAUTHORIZED RECORDING THREAT DETECTED! THE SCREEN HAS BEEN TEMPORARILY BLACKED OUT."_
4. Remove the phone from view. The overlay **automatically closes** after the model confirms the phone is no longer present (3 consecutive clear frames).

### Other Test Targets

The process scanner also detects these applications (if installed):

| Process Name | Application |
|-------------|-------------|
| `obs64.exe` / `obs32.exe` | OBS Studio |
| `ShareX.exe` | ShareX |
| `screenflow` | ScreenFlow (macOS) |
| `quicktime` | QuickTime Player |
| `bandicam` | Bandicam |
| `camtasia` | Camtasia |

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/logs` | Retrieve all incident log entries (newest first, max 100) |
| `GET` | `/api/mode` | Get current enforcement mode (`{ "active_mode": true/false }`) |
| `POST` | `/api/toggle-mode` | Set mode — Body: `{ "active": true }` or `{ "active": false }` |
| `POST` | `/api/clear-logs` | Delete all entries from the incident log database |
| `WebSocket` | `/ws/alerts` | Real-time stream of `{ type: "threat"/"status", data: {...} }` |

---

## 📄 License

This project was developed as a cybersecurity group project for academic purposes.

---

<p align="center">
  <b>OmniGuard Endpoint Agent</b> • Built for Unauthorized Capture Prevention
</p>
