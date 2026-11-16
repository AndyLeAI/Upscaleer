@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Upscaleer - Tauri v2 Build Windows

echo =======================================================
echo             UPSCALEER - TAURI V2 BUILD
echo =======================================================
echo.
if not exist "node_modules\.bin\tauri.cmd" (
  echo [ERROR] Tauri CLI is not installed. Run install.bat first.
  pause
  exit /b 1
)
if not exist "upstream\public\models\manifest.json" (
  echo [ERROR] AI models are missing. Run install.bat first.
  pause
  exit /b 1
)
where cargo >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Rust Cargo missing. Install Rust then run rustup update stable.
  pause
  exit /b 1
)
call npm run build:win || goto fail
echo.
echo [OK] EXE: src-tauri\target\release\upscaleer.exe
echo [OK] NSIS: src-tauri\target\release\bundle\nsis\
pause
exit /b 0
:fail
echo.
echo [ERROR] Tauri v2 Windows build failed; read the error above.
pause
exit /b 1
