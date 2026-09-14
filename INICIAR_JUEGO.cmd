@echo off
cd /d "%~dp0"
if not exist node_modules\vite\bin\vite.js (
  echo Primero ejecuta npm.cmd install en esta carpeta.
  pause
  exit /b 1
)
echo Iniciando el juego...
echo El navegador se abrira solo en: http://127.0.0.1:5173
echo Si no se abre, copia y pega esa direccion en tu navegador.
echo Para cerrar el servidor, pulsa Ctrl+C.
call npm.cmd run dev -- --open
pause
