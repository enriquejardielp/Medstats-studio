FROM python:3.11-slim-bookworm

# Evitar prompts interactivos durante instalación
ENV PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    PORT=8000

# Instalar R y dependencias de sistema requeridas para paquetes estadísticos
RUN apt-get update && apt-get install -y --no-install-recommends \
    r-base \
    r-base-dev \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    build-essential \
    gfortran \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Instalar paquetes de R requeridos por MedStats Studio
RUN R -e "install.packages(c('jsonlite', 'car', 'table1', 'dunn.test', 'irr', 'pROC', 'survival', 'pwr', 'ggplot2', 'RColorBrewer', 'viridis'), repos='https://cloud.r-project.org')"

WORKDIR /app

# Instalar dependencias de Python
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copiar el backend al contenedor
COPY backend ./backend

EXPOSE 8000

# Iniciar Uvicorn con el puerto dinámico asignado por Render ($PORT)
CMD ["sh", "-c", "uvicorn backend.api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
