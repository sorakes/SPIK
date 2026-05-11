FROM diogod2r/omnivoice-fastapi:latest

USER root

# Install Spik dependencies: Redis, Supervisor, Node.js (for frontend build)
RUN apt-get update && apt-get install -y \
    redis-server \
    supervisor \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Fix Pedalboard (just in case)
RUN pip uninstall -y pedalboard 2>/dev/null || true
RUN python -c "import pathlib; p=pathlib.Path('/opt/conda/lib/python3.11/site-packages/pedalboard'); p.mkdir(parents=True, exist_ok=True); (p/'__init__.py').write_text('class Pedalboard:\n def __init__(self, *a, **k): pass\n def __call__(self, a, sr): return a\nclass HighpassFilter:\n def __init__(self, *a, **k): pass\nclass LowpassFilter:\n def __init__(self, *a, **k): pass\nclass NoiseGate:\n def __init__(self, *a, **k): pass\nclass Compressor:\n def __init__(self, *a, **k): pass\n')"

# Set up Spik Backend
WORKDIR /spik
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Set up Spik Frontend
COPY frontend/ ./frontend/
WORKDIR /spik/frontend
# Note: we change API url to relative to use the same host/port
RUN npm install && VITE_API_URL="" npm run build

# Copy remaining code
WORKDIR /spik
COPY backend/ ./backend/
COPY supervisord-mega.conf /etc/supervisor/conf.d/spik.conf

ENV HF_HOME=/app/omnivoice_data/huggingface
ENV OMNIVOICE_DATA_DIR=/app/omnivoice_data
ENV REDIS_URL=redis://localhost:6379/0
ENV OMNIVOICE_URL=http://localhost:8880
ENV PYTHONUNBUFFERED=1

CMD ["supervisord", "-n", "-c", "/etc/supervisor/conf.d/spik.conf"]
