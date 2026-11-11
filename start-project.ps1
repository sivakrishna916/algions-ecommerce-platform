
$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

if (!(Test-Path $backend) -or !(Test-Path $frontend)) {
    Write-Host "Error: backend or frontend folder not found." -ForegroundColor Red
    exit 1
}

Write-Host "Starting Algions E-Commerce..." -ForegroundColor Cyan

# Start backend on port 5055
Start-Process -FilePath "cmd.exe" `
    -WorkingDirectory $backend `
    -ArgumentList @("/k", "set PORT=5055 && npm.cmd run dev")

Start-Sleep -Seconds 2

# Start frontend with backend proxy on port 5055
Start-Process -FilePath "cmd.exe" `
    -WorkingDirectory $frontend `
    -ArgumentList @("/k", "set VITE_PROXY_TARGET=http://localhost:5055 && npm.cmd run dev")

Write-Host ""
Write-Host "Backend:  http://localhost:5055" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host "API Docs: http://localhost:5055/api/docs" -ForegroundColor Green
Write-Host ""
Write-Host "Keep both server windows open while working."
