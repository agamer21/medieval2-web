@echo off
cd /d "%~dp0"
python tools\prepare_prologue.py
python tools\server.py --open
pause
