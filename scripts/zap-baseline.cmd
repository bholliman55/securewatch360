@echo off
set "ZAP_WRK=%~dp0..\.zap-wrk"
if not exist "%ZAP_WRK%" mkdir "%ZAP_WRK%"
docker run --rm -v "%ZAP_WRK%:/zap/wrk" -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py %*
