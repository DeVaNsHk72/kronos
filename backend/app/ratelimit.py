"""Minimal in-memory per-IP sliding-window rate limiter.

Per-process only — fine for a single Cloud Run instance. If min-instances
or max-instances ever go above 1, each instance enforces its own window,
so the effective limit multiplies by instance count.
"""

import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException, Request

_hits: dict[str, list[float]] = defaultdict(list)
_lock = Lock()


def _client_ip(request: Request) -> str:
    # Cloud Run terminates TLS through an internal proxy, so
    # request.client.host is always the proxy's link-local address — the
    # real visitor IP is the first hop in X-Forwarded-For instead.
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def limit(max_requests: int, window_seconds: int):
    def dep(request: Request):
        ip = _client_ip(request)
        now = time.monotonic()
        with _lock:
            hits = _hits[ip]
            cutoff = now - window_seconds
            while hits and hits[0] < cutoff:
                hits.pop(0)
            if len(hits) >= max_requests:
                raise HTTPException(429, "Too many requests — slow down and try again shortly.")
            hits.append(now)
    return dep
