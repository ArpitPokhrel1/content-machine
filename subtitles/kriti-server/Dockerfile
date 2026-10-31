# Kriti ASR as a Hugging Face Docker Space (free CPU tier: 2 vCPU, 16 GB).
# HF proxies the Space URL to the port in README.md's `app_port` (7860).
FROM python:3.11-slim

# git: pip installs Kriti from its repo. libsndfile1 + ffmpeg: audio decoding for NeMo.
# build-essential: some NeMo/ASR deps compile small extensions.
RUN apt-get update && apt-get install -y --no-install-recommends \
    git build-essential libsndfile1 ffmpeg \
 && rm -rf /var/lib/apt/lists/*

# HF Spaces run as a non-root user; give it writable HOME + model cache.
RUN useradd -m -u 1000 user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    HF_HOME=/home/user/.cache/huggingface
WORKDIR /app

# Small, fast layer first so the heavy ML install is cached across rebuilds.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# The heavy, version-sensitive step: Kriti pulls in PyTorch + NeMo. This is the
# line most likely to need adjusting per Kriti release (extras name, pins). If a
# build fails, read the HF build log and tweak here — the rest is stable.
# To shrink the image you can pre-install CPU-only torch before this line:
#   RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir "kriti[runtime] @ git+https://github.com/Naamche-Labs/kriti.git"

COPY server.py .
RUN chown -R user:user /app /home/user
USER user

EXPOSE 7860
# Set KRITI_AUTH_TOKEN as a Space secret to require a bearer token on POST /.
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "7860"]
