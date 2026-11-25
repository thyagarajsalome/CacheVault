@echo off
title Launching CacheVault Pro...
cd /d "%~dp0"
taskkill /F /IM CacheVault.exe 2>nul
taskkill /F /IM app.exe 2>nul
start "" "D:\Agent-Drive\src-tauri\target\release\CacheVault.exe"
exit
