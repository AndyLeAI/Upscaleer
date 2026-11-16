@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Upscaleer - Install Tauri v2 + Rust

echo =======================================================
echo               UPSCALEER - INSTALL
 echo               TAURI V2 + RUST ONLY
 echo               NO ELECTRON
 echo =======================================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js 24 LTS or newer is required.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm required.
  pause
  exit /b 1
)
where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git for Windows required: https://git-scm.com/download/win
  pause
  exit /b 1
)
where cargo >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Rust Cargo missing. Install stable Rust MSVC from https://rustup.rs/
  echo [INFO] Also install Visual Studio Build Tools with Desktop development with C++.
  pause
  exit /b 1
)
node scripts\setup.cjs
if errorlevel 1 (
  echo.
  echo [ERROR] Installation failed. Review messages above.
  pause
  exit /b 1
)
echo.
echo [OK] Tauri v2 install finished. Start with dev.bat.
pause
exit /b 0
