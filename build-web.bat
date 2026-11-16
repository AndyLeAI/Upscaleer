@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Upscaleer - Build Web Preview
if not exist "upstream\package.json" (
  echo [ERROR] Run install.bat first.
  pause
  exit /b 1
)
node scripts\patch-upstream.cjs || goto fail
node scripts\patch-web.cjs || goto fail
set "BASE_PATH=/Upscaleer/"
set "SITE_URL=https://AndyLeAI.github.io"
call npm --prefix upstream run build || goto fail
echo [OK] Web output: upstream\dist\
pause
exit /b 0
:fail
echo [ERROR] Build failed.
pause
exit /b 1
