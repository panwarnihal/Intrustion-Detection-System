# Project Plan: AI-Based Unauthorized Screen Recording & Physical Capture Detection System

## 1. Executive Summary
The **AI-Based Unauthorized Screen Recording & Physical Capture Detection System** is an endpoint security and monitoring tool designed to mitigate digital and visual data exfiltration. The system operates as a hybrid, two-tier architecture comprising a lightweight **FastAPI backend (detection engine)** and a responsive **React (Vite + Tailwind CSS) administrative dashboard**.

The system handles two primary threat vectors:
1. **Software-Based Exfiltration:** Background screen recorders, broadcasting tools, and capture utilities.
2. **Physical Visual Capture:** External smartphone/camera lenses pointed at the screen.

It features a dual-mode enforcement model (Passive Monitoring vs. Active Force-Kill & Blackout), and is optimized to run reliably on standard CPU hardware without requiring dedicated GPUs.

---

## 2. System Architecture