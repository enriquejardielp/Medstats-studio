#!/bin/zsh

# macOS launcher for MedStats Studio
# - abre un terminal para el backend
# - abre un terminal para el frontend
# - espera a que los servidores estén listos
# - abre el navegador en http://localhost:5173

PROJECT_ROOT="/Users/joaquingarciamartinez/Desktop/medstats-studio"
BACKEND_VENV="$PROJECT_ROOT/backend/venv/bin/activate"

if [[ ! -d "$PROJECT_ROOT" ]]; then
  echo "No se encontró el proyecto en: $PROJECT_ROOT"
  exit 1
fi

if [[ ! -f "$BACKEND_VENV" ]]; then
  echo "No se encontró el entorno virtual de backend en: $BACKEND_VENV"
  echo "Crea el entorno virtual o ajusta la ruta dentro de este script."
  exit 1
fi

osascript <<APPLESCRIPT
tell application "Terminal"
    do script "cd '$PROJECT_ROOT' && source '$BACKEND_VENV' && export PYTHONPATH='$PROJECT_ROOT' && python -m uvicorn backend.api.main:app --reload --reload-dir backend/api --reload-exclude backend/venv"
    do script "cd '$PROJECT_ROOT/frontend' && npm run dev"
end tell
APPLESCRIPT

echo "Esperando a que el servidor backend esté listo..."
MAX_TRIES=15
COUNT=0
while ! curl -s http://localhost:8000/docs > /dev/null && [[ $COUNT -lt $MAX_TRIES ]]; do
  sleep 1
  COUNT=$((COUNT + 1))
done

open "http://localhost:5173"

