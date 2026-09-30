@echo off

echo Starting Chrome for AtoPlay automation...

"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
--remote-debugging-port=9222 ^
--user-data-dir="%LOCALAPPDATA%\AIVideoChrome" ^
--no-first-run ^
--no-default-browser-check ^
"https://atoplay.com"

echo.
echo Chrome started.
echo Keep this window open.
pause