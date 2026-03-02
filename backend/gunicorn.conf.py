"""Gunicorn configuration for production multi-worker deployment.

Usage:
    gunicorn app.main:app -c gunicorn.conf.py

Reads WEB_WORKERS from environment (default 4).
Each worker runs a separate uvicorn event loop, multiplying
concurrent request capacity by the number of workers.
"""

import multiprocessing
import os

# Worker class — UvicornWorker gives each Gunicorn worker its own async event loop
worker_class = "uvicorn.workers.UvicornWorker"

# Number of worker processes: configurable via env, default = 2 * CPU + 1
workers = int(os.getenv("WEB_WORKERS", min(multiprocessing.cpu_count() * 2 + 1, 8)))

# Bind address
bind = "0.0.0.0:8000"

# Graceful timeout (seconds) — how long to wait for in-flight requests before kill
graceful_timeout = 30
timeout = 120  # max time a worker can take on a single request

# Keep-alive connections (seconds) — reduces TCP handshake overhead for repeat clients
keepalive = 5

# Preload the app in master process for shared memory + faster fork
preload_app = True

# Access log format
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("LOG_LEVEL", "info")

# Max requests per worker before recycling (prevents memory leaks)
max_requests = 2000
max_requests_jitter = 200
