import os
import sys
import time
import subprocess
import threading
import psutil
from typing import Callable, Optional, Dict, Any
from backend import database

# Global state control
running = True
blackout_proc: Optional[subprocess.Popen] = None
status_lock = threading.Lock()

system_status: Dict[str, Any] = {
    "camera": "disconnected",
    "camera_fps": 0,
    "process_scanner": "idle",
    "process_count": 0,
    "active_mode": False
}

def update_status(key: str, value: Any, on_status_callback: Optional[Callable[[Dict[str, Any]], None]] = None):
    with status_lock:
        system_status[key] = value
        # Sync current active mode from db
        system_status["active_mode"] = database.get_active_mode()
        current_status = system_status.copy()
    if on_status_callback:
        on_status_callback(current_status)

def manage_blackout(show: bool):
    """Start or stop the screen blackout overlay window."""
    global blackout_proc
    blackout_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "blackout.py")
    
    if show:
        active_mode = database.get_active_mode()
        if active_mode:
            # Spawn blackout if not running
            if blackout_proc is None or blackout_proc.poll() is not None:
                try:
                    blackout_proc = subprocess.Popen([sys.executable, blackout_script])
                except Exception as e:
                    print(f"Error starting blackout overlay: {e}")
    else:
        # Stop blackout if running
        if blackout_proc is not None and blackout_proc.poll() is None:
            try:
                blackout_proc.terminate()
                blackout_proc.wait(timeout=2)
            except Exception:
                try:
                    blackout_proc.kill()
                except Exception:
                    pass
            blackout_proc = None

def process_scanner_worker(
    on_threat: Callable[[Dict[str, Any]], None],
    on_status: Callable[[Dict[str, Any]], None]
):
    """Worker Thread A: Scans active OS processes every 2 seconds for known recorders."""
    update_status("process_scanner", "running", on_status)
    
    # List of keywords indicating a screen recorder
    recorder_keywords = ["obs", "snippingtool", "sharex", "screenflow", "quicktime", "screenrecorder", "bandicam", "camtasia", "fraps"]
    
    # Track logged pids to prevent spamming
    recent_logged_pids = {}
    
    while running:
        try:
            active_mode = database.get_active_mode()
            update_status("active_mode", active_mode, on_status)
            
            pids_checked = 0
            threat_found = False
            
            # Clean up old logs from tracking
            current_time = time.time()
            recent_logged_pids = {pid: t for pid, t in recent_logged_pids.items() if current_time - t < 15}
            
            for proc in psutil.process_iter(['pid', 'name']):
                pids_checked += 1
                try:
                    proc_name = proc.info['name']
                    if not proc_name:
                        continue
                    
                    proc_name_lower = proc_name.lower()
                    # Check if any keyword matches
                    matches_threat = any(kw in proc_name_lower for kw in recorder_keywords)
                    
                    if matches_threat:
                        threat_found = True
                        pid = proc.info['pid']
                        
                        # Only act if we haven't handled this PID in the last 15 seconds
                        if pid not in recent_logged_pids:
                            recent_logged_pids[pid] = current_time
                            
                            # Decide action
                            action = "Terminated (Active Kill)" if active_mode else "Logged (Passive Monitor)"
                            
                            # Log to Database
                            incident = database.log_incident(
                                threat_category="Screen Recorder",
                                target_detail=f"{proc_name} (PID: {pid})",
                                action_taken=action
                            )
                            
                            # Call the UI WebSocket alert callback
                            on_threat(incident)
                            
                            # Execute kill in active mode
                            if active_mode:
                                try:
                                    proc.kill()
                                except Exception as kill_err:
                                    print(f"Failed to kill process {proc_name} (PID {pid}): {kill_err}")
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    continue
            
            update_status("process_count", pids_checked, on_status)
            time.sleep(2)
            
        except Exception as e:
            print(f"Error in process scanner: {e}")
            update_status("process_scanner", "error", on_status)
            time.sleep(5)

def webcam_monitor_worker(
    on_threat: Callable[[Dict[str, Any]], None],
    on_status: Callable[[Dict[str, Any]], None]
):
    """Worker Thread B: Webcam frame-skipped YOLOv8 phone detector running on CPU."""
    # Delay imports of opencv/ultralytics to allow pip installation to finish
    try:
        import cv2
        from ultralytics import YOLO
    except ImportError as err:
        print(f"Waiting for YOLO/OpenCV dependencies to install... {err}")
        # Wait a bit and try importing again
        time.sleep(10)
        try:
            import cv2
            from ultralytics import YOLO
        except ImportError:
            update_status("camera", "error", on_status)
            return

    # Load YOLOv8 nano model
    try:
        model = YOLO("yolov8n.pt")
    except Exception as e:
        print(f"Error loading YOLO model: {e}")
        update_status("camera", "error", on_status)
        return
        
    cap = None
    frame_count = 0
    phone_detected_state = False
    consecutive_nofind_frames = 0
    
    fps_start_time = time.time()
    fps_counter = 0
    
    while running:
        try:
            active_mode = database.get_active_mode()
            update_status("active_mode", active_mode, on_status)
            
            if cap is None or not cap.isOpened():
                update_status("camera", "disconnected", on_status)
                cap = cv2.VideoCapture(0)
                if not cap.isOpened():
                    # Retry in 5 seconds
                    time.sleep(5)
                    continue
                update_status("camera", "connected", on_status)
                fps_start_time = time.time()
                fps_counter = 0
            
            ret, frame = cap.read()
            if not ret:
                cap.release()
                cap = None
                time.sleep(2)
                continue
                
            frame_count += 1
            fps_counter += 1
            
            # FPS tracking
            now = time.time()
            if now - fps_start_time >= 1.0:
                current_fps = round(fps_counter / (now - fps_start_time), 1)
                update_status("camera_fps", current_fps, on_status)
                fps_counter = 0
                fps_start_time = now
            
            # Skip frames: process 1 frame every 4 frames (25% CPU usage check)
            if frame_count % 4 != 0:
                continue
                
            # Resize frame to 480x360 to minimize CPU usage
            frame_resized = cv2.resize(frame, (480, 360))
            
            # Run YOLO prediction strictly on CPU looking for class index 67 (cell phone)
            results = model.predict(
                source=frame_resized,
                device="cpu",
                classes=[67],
                conf=0.5,
                verbose=False
            )
            
            cell_phone_detected = False
            for r in results:
                if len(r.boxes) > 0:
                    cell_phone_detected = True
                    break
            
            if cell_phone_detected:
                consecutive_nofind_frames = 0
                if not phone_detected_state:
                    phone_detected_state = True
                    action = "Blocked Screen" if active_mode else "Logged (Passive Monitor)"
                    
                    # Log to database
                    incident = database.log_incident(
                        threat_category="Physical Device",
                        target_detail="Cell Phone detected in camera frame",
                        action_taken=action
                    )
                    
                    # Trigger alert callback
                    on_threat(incident)
                    
                    # Apply screen blackout if in active mode
                    if active_mode:
                        manage_blackout(show=True)
            else:
                if phone_detected_state:
                    consecutive_nofind_frames += 1
                    # Require 3 consecutive frames with no cell phone before clearing
                    if consecutive_nofind_frames >= 3:
                        phone_detected_state = False
                        # Close blackout window if running
                        manage_blackout(show=False)
                        
                        incident_cleared = {
                            "timestamp": time.time(),
                            "threat_category": "Physical Device",
                            "target_detail": "Cell Phone threat cleared",
                            "action_taken": "Screen Restored"
                        }
                        on_threat(incident_cleared)
                        
        except Exception as e:
            print(f"Error in camera loop: {e}")
            time.sleep(2)
            
    if cap is not None:
        cap.release()
    manage_blackout(show=False)

def start_detectors(
    on_threat: Callable[[Dict[str, Any]], None],
    on_status: Callable[[Dict[str, Any]], None]
):
    """Initialize and start background threat scanner threads."""
    global running
    running = True
    
    # Ensure database settings sync
    update_status("active_mode", database.get_active_mode(), on_status)
    
    # Thread A
    proc_thread = threading.Thread(
        target=process_scanner_worker,
        args=(on_threat, on_status),
        daemon=True,
        name="ProcessScannerThread"
    )
    proc_thread.start()
    
    # Thread B
    cam_thread = threading.Thread(
        target=webcam_monitor_worker,
        args=(on_threat, on_status),
        daemon=True,
        name="WebcamMonitorThread"
    )
    cam_thread.start()

def stop_detectors():
    """Stop the background threat scanners."""
    global running
    running = False
    manage_blackout(show=False)
