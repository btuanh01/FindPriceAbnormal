@echo off
echo Starting FindPrice Dashboard...

:: Start the backend server
start "Backend Server" cmd /k "cd server && npm start"

:: Start the frontend development server
start "Frontend Server" cmd /k "cd client && npm start"

echo Both servers are starting up...
echo Backend will be available at http://localhost:5000
echo Frontend will be available at http://localhost:3077
echo.
echo Press any key to close this window...
pause > nul 