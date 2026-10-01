# The mobile app's API. Built from the repository root (it needs payments_core.py), e.g. by Railway via railway.json.
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
COPY api/requirements.txt api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt
COPY payments_core.py .
COPY api/main.py api/main.py
# Railway (and most hosts) set PORT; 8000 when running locally.
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
