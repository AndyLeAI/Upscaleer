@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Upscaleer - Publish to AndyLeAI GitHub
where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git for Windows is required.
  pause
  exit /b 1
)
echo.
echo Create an EMPTY PUBLIC repository called Upscaleer first:
echo https://github.com/new
echo Do not initialize with README/license/gitignore.
echo.
set /p "ok=Repository created? Type YES to push: "
if /i not "%ok%"=="YES" exit /b 1
if not exist ".git" (
  git init -b main || goto fail
)
git branch -M main || goto fail
git remote get-url origin >nul 2>nul
if errorlevel 1 (
  git remote add origin https://github.com/AndyLeAI/Upscaleer.git || goto fail
)
echo.
echo [INFO] Remote:
git remote -v
echo.
echo Ensure this is https://github.com/AndyLeAI/Upscaleer.git before continuing.
set /p "ok2=Type YES to commit and push: "
if /i not "%ok2%"=="YES" exit /b 1
git add . || goto fail
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Add Upscaleer desktop and GitHub Pages deployment" || goto fail
)
git push -u origin main || goto fail
echo.
echo [OK] Code pushed. In your repo Settings - Pages, select GitHub Actions.
pause
exit /b 0
:fail
echo [ERROR] Publish failed. Review the details above.
pause
exit /b 1
