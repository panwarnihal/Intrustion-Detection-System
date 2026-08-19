import asyncio
import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend import database
from backend import detector

# Shared event loop for scheduling websocket broadcasts from background threads
loop = None

class ConnectionManager:
    def __init__(self):
        self.active_connections = []
        self.lock = threading.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        with self.lock:
            self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        with self.lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        import json
        with self.lock:
            connections = list(self.active_connections)
        for connection in connections:
            try:
                await connection.send_text(json.dumps(message))
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()

def on_threat(incident_dict: dict):
    """Callback triggered by detector thread when threat is found."""
    if loop:
        asyncio.run_coroutine_threadsafe(
            manager.broadcast({"type": "threat", "data": incident_dict}),
            loop
        )

def on_status(status_dict: dict):
    """Callback triggered by detector thread to update camera/process stats."""
    if loop:
        asyncio.run_coroutine_threadsafe(
            manager.broadcast({"type": "status", "data": status_dict}),
            loop
        )

@asynccontextmanager
async def lifespan(app: FastAPI):
    global loop
    loop = asyncio.get_running_loop()
    
    # Start process scanner and webcam monitor background threads
    detector.start_detectors(on_threat, on_status)
    
    yield
    
    # Clean up detector threads and closing scripts
    detector.stop_detectors()

app = FastAPI(
    title="AI-Based Unauthorized Screen Recording Detection API",
    description="Cybersecurity endpoint protection monitoring and active prevention system.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware to allow React app to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development, allow connections from Vite frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ToggleModeRequest(BaseModel):
    active: bool

@app.get("/api/logs")
def get_logs():
    """Retrieve security incident logs history."""
    try:
        return database.get_logs()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/mode")
def get_mode():
    """Get the current system enforcement mode."""
    return {"active_mode": database.get_active_mode()}

@app.post("/api/toggle-mode")
def toggle_mode(req: ToggleModeRequest):
    """Switch active/passive enforcement mode."""
    try:
        database.set_active_mode(req.active)
        
        # If toggling off active mode, ensure any open blackout is closed immediately
        if not req.active:
            detector.manage_blackout(show=False)
            
        # Trigger immediate status update to all connected clients
        detector.update_status("active_mode", req.active, on_status)
        
        return {"status": "success", "active_mode": req.active}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/clear-logs")
def clear_logs():
    """Clear the database log history."""
    try:
        database.clear_logs()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/alerts")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket connection route for live telemetry updates."""
    await manager.connect(websocket)
    
    # Immediately send the current status upon connection
    with detector.status_lock:
        current_status = detector.system_status.copy()
    await websocket.send_json({"type": "status", "data": current_status})
    
    try:
        while True:
            # We don't expect messages from client, but keep connection open
            data = await websocket.receive_text()
            # Echo or ignore
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
