@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Upscaleer - Tauri v2 Development

echo =======================================================
echo            UPSCALEER - TAURI V2 DEV
echo =======================================================
echo.
if not exist "src-tauri\Cargo.toml" (
  echo [ERROR] Tauri v2 source is missing.
  pause
  exit /b 1
)
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
node scripts\patch-upstream.cjs || goto fail
call npm run dev || goto fail
exit /b 0
:fail
echo.
echo [ERROR] Tauri development failed. Check Rust toolchain, Visual Studio C++ Build Tools, and WebView2.
pause
exit /b 1
