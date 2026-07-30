FROM python:3.11-slim

WORKDIR /app

# System deps for numpy/scipy wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential && \
    rm -rf /var/lib/apt/lists/*

# Python deps (install before copying code for layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Backend code
COPY backend/ backend/

# Data files (added via .gitignore exception or mounted)
# These go into DERIVED_DATA/ inside the container
COPY DERIVED_DATA/questions_v2.db DERIVED_DATA/questions_v2.db
COPY DERIVED_DATA/papers_v2.db DERIVED_DATA/papers_v2.db
COPY DERIVED_DATA/embeddings.npy DERIVED_DATA/embeddings.npy
COPY DERIVED_DATA/emb_keys.json DERIVED_DATA/emb_keys.json
COPY DERIVED_DATA/figures/ DERIVED_DATA/figures/

# Pre-download the embedding model so cold starts don't fetch it
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-small-en-v1.5')"

ENV DERIVED_DATA_DIR=/app/DERIVED_DATA
ENV PORT=8080

EXPOSE 8080

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8080"]
