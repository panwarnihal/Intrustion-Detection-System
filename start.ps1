<#
.SYNOPSIS
    OmniGuard — One-click launcher for the full detection system.
    Starts the FastAPI backend and React frontend in parallel.

.DESCRIPTION
    This script will:
    1. Create a Python virtual environment if one doesn't exist.
    2. Install Python dependencies from requirements.txt.
    3. Install Node.js dependencies for the frontend.
    4. Launch the FastAPI backend (uvicorn) on port 8000.
    5. Launch the Vite React dev server on port 5173.

    Both servers open in separate console windows so you can see their logs independently.
    Closing THIS window will NOT stop them — close each server window individually,
    or press Ctrl+C here after the servers start to terminate them together.

.NOTES
    Prerequisites: Python 3.10+, Node.js 18+, npm
    Run from the project root: .\start.ps1
#>

param(
    [switch]$SkipInstall,
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 5173
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
if (-not $ProjectRoot) { $ProjectRoot = Get-Location }

# ─────────────────────────────────────────────
# Colors & Banner
# ─────────────────────────────────────────────
function Write-Banner {
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║                                                  ║" -ForegroundColor Cyan
    Write-Host "  ║   🛡️  OmniGuard Endpoint Detection System       ║" -ForegroundColor Cyan
    Write-Host "  ║   AI-Based Screen Recording & Capture Defense    ║" -ForegroundColor Cyan
    Write-Host "  ║                                                  ║" -ForegroundColor Cyan
    Write-Host "  ╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step($step, $msg) {
    Write-Host "  [$step] " -ForegroundColor Yellow -NoNewline
    Write-Host $msg -ForegroundColor White
}

function Write-Success($msg) {
    Write-Host "   ✅ " -ForegroundColor Green -NoNewline
    Write-Host $msg -ForegroundColor Gray
}

function Write-Info($msg) {
    Write-Host "   ℹ️  " -ForegroundColor Blue -NoNewline
    Write-Host $msg -ForegroundColor Gray
}

function Write-Err($msg) {
    Write-Host "   ❌ " -ForegroundColor Red -NoNewline
    Write-Host $msg -ForegroundColor Red
}

# ─────────────────────────────────────────────
# Pre-flight Checks
# ─────────────────────────────────────────────
Write-Banner

Write-Step "1/5" "Running pre-flight checks..."

# Check Python
try {
    $pythonVersion = & python --version 2>&1
    Write-Success "Python found: $pythonVersion"
} catch {
    Write-Err "Python not found. Please install Python 3.10+ from https://www.python.org/downloads/"
    exit 1
}

# Check Node.js
try {
    $nodeVersion = & node --version 2>&1
    Write-Success "Node.js found: $nodeVersion"
} catch {
    Write-Err "Node.js not found. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
}

# Check npm
try {
    $npmVersion = & npm --version 2>&1
    Write-Success "npm found: v$npmVersion"
} catch {
    Write-Err "npm not found. It should come with Node.js installation."
    exit 1
}

# ─────────────────────────────────────────────
# Python Virtual Environment
# ─────────────────────────────────────────────
Write-Host ""
Write-Step "2/5" "Setting up Python virtual environment..."

$venvPath = Join-Path $ProjectRoot ".venv"
$venvPython = Join-Path $venvPath "Scripts\python.exe"
$venvPip = Join-Path $venvPath "Scripts\pip.exe"

if (-not (Test-Path $venvPython)) {
    Write-Info "Creating virtual environment at .venv..."
    & python -m venv $venvPath
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to create virtual environment."
        exit 1
    }
    Write-Success "Virtual environment created."
} else {
    Write-Success "Virtual environment already exists."
}

# ─────────────────────────────────────────────
# Install Python Dependencies
# ─────────────────────────────────────────────
Write-Host ""
Write-Step "3/5" "Installing Python dependencies..."

if (-not $SkipInstall) {
    $reqFile = Join-Path $ProjectRoot "requirements.txt"
    if (Test-Path $reqFile) {
        & $venvPip install -r $reqFile --quiet 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Info "Retrying with verbose output..."
            & $venvPip install -r $reqFile
        }
        Write-Success "Python packages installed."
    } else {
        Write-Err "requirements.txt not found at project root."
        exit 1
    }
} else {
    Write-Info "Skipped (--SkipInstall flag set)."
}

# ─────────────────────────────────────────────
# Install Node Dependencies
# ─────────────────────────────────────────────
Write-Host ""
Write-Step "4/5" "Installing frontend Node.js dependencies..."

$frontendDir = Join-Path $ProjectRoot "frontend"
$nodeModules = Join-Path $frontendDir "node_modules"

if (-not $SkipInstall) {
    if (-not (Test-Path $nodeModules)) {
        Write-Info "Running npm install in frontend/..."
        Push-Location $frontendDir
        & npm install --silent 2>&1 | Out-Null
        Pop-Location
        Write-Success "Node modules installed."
    } else {
        Write-Success "node_modules already exists."
    }
} else {
    Write-Info "Skipped (--SkipInstall flag set)."
}

# ─────────────────────────────────────────────
# Launch Servers
# ─────────────────────────────────────────────
Write-Host ""
Write-Step "5/5" "Launching servers..."
Write-Host ""

$uvicornPath = Join-Path $venvPath "Scripts\uvicorn.exe"

# Start Backend in a new window
Write-Info "Starting FastAPI backend on port $BackendPort..."
$backendProc = Start-Process -FilePath $uvicornPath `
    -ArgumentList "backend.main:app", "--reload", "--host", "0.0.0.0", "--port", "$BackendPort" `
    -WorkingDirectory $ProjectRoot `
    -PassThru `
    -WindowStyle Normal

Write-Success "Backend started (PID: $($backendProc.Id)) → http://localhost:$BackendPort"

# Give backend a moment to bind the port
Start-Sleep -Seconds 2

# Start Frontend in a new window
Write-Info "Starting Vite frontend on port $FrontendPort..."
$frontendProc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "cd /d `"$frontendDir`" && npm run dev" `
    -PassThru `
    -WindowStyle Normal

Write-Success "Frontend started (PID: $($frontendProc.Id)) → http://localhost:$FrontendPort"

# ─────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────
Write-Host ""
Write-Host "  ┌──────────────────────────────────────────────────┐" -ForegroundColor Green
Write-Host "  │          🚀 OmniGuard is now running!            │" -ForegroundColor Green
Write-Host "  │                                                  │" -ForegroundColor Green
Write-Host "  │   Dashboard:  http://localhost:$FrontendPort           │" -ForegroundColor Green
Write-Host "  │   API:        http://localhost:$BackendPort            │" -ForegroundColor Green
Write-Host "  │   API Docs:   http://localhost:$BackendPort/docs       │" -ForegroundColor Green
Write-Host "  │                                                  │" -ForegroundColor Green
Write-Host "  │   Press Ctrl+C or close server windows to stop.  │" -ForegroundColor Green
Write-Host "  └──────────────────────────────────────────────────┘" -ForegroundColor Green
Write-Host ""

# Wait for user to press Ctrl+C, then clean up both processes
Write-Host "  Waiting... Press Ctrl+C to shut down both servers." -ForegroundColor DarkGray
Write-Host ""

try {
    # Keep script alive — wait for either process to exit
    while (-not $backendProc.HasExited -and -not $frontendProc.HasExited) {
        Start-Sleep -Seconds 1
    }
} catch {
    # Ctrl+C was pressed
} finally {
    Write-Host ""
    Write-Host "  Shutting down..." -ForegroundColor Yellow

    if (-not $backendProc.HasExited) {
        Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
        Write-Info "Backend server stopped."
    }
    if (-not $frontendProc.HasExited) {
        Stop-Process -Id $frontendProc.Id -Force -ErrorAction SilentlyContinue
        # Also kill any child node processes spawned by cmd
        Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
            $_.StartTime -ge $frontendProc.StartTime
        } | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Info "Frontend server stopped."
    }

    Write-Host ""
    Write-Success "All servers shut down. Goodbye!"
    Write-Host ""
}
