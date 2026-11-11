@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-HwpxBridge.ps1"
if errorlevel 1 (echo Setup failed. Please keep the error shown above.)
pause
