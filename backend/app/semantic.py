"""Semantic search over the precomputed question embeddings.

Loads the float16 matrix (embeddings.npy) and its row-aligned text hashes
(emb_keys.json) once, plus the local bge-small model for query embedding.
A query -> top (text_hash, score) pairs; the caller resolves hashes to
question rows via the text_hash column and applies filters.
"""

import json
import threading

import numpy as np

from .config import EMBEDDINGS, EMB_KEYS, EMB_MODEL, QUERY_PREFIX

_lock = threading.Lock()
_state = {"mat": None, "keys": None, "model": None}


def _ensure():
    if _state["mat"] is not None:
        return
    with _lock:
        if _state["mat"] is not None:
            return
        mat = np.load(EMBEDDINGS).astype(np.float32)   # [N, 384], L2-normalized
        keys = json.loads(EMB_KEYS.read_text(encoding="utf-8"))
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer(EMB_MODEL, device="cpu")
        _state.update(mat=mat, keys=keys, model=model)


def is_ready():
    return _state["mat"] is not None


def warm():
    _ensure()


def search(query: str, pool: int = 800):
    """Return [(text_hash, score), ...] for the top `pool` nearest questions."""
    _ensure()
    mat, keys, model = _state["mat"], _state["keys"], _state["model"]
    qv = model.encode([QUERY_PREFIX + query], normalize_embeddings=True,
                      convert_to_numpy=True)[0].astype(np.float32)
    scores = mat @ qv
    pool = min(pool, len(scores))
    idx = np.argpartition(-scores, pool - 1)[:pool]
    idx = idx[np.argsort(-scores[idx])]
    return [(keys[i], float(scores[i])) for i in idx]


def search_rows(con, query, filters, select, pool=800):
    """Semantic hits -> filtered question rows, ranked by similarity.

    Returns (rows, {text_hash: score}). Both /api/search/semantic and /api/chat
    need exactly this; keeping one copy stops the two ranking paths drifting.
    """
    hits = search(query, pool=pool)
    if not hits:
        return [], {}
    rank = {h: i for i, (h, _) in enumerate(hits)}
    hashes = list(rank)
    where, params = filters.where("q")
    rows = con.execute(
        f"SELECT {select}, q.text_hash FROM questions q "
        f"WHERE q.text_hash IN ({','.join('?' * len(hashes))}) {where}",
        hashes + params,
    ).fetchall()
    rows.sort(key=lambda r: rank.get(r["text_hash"], 1 << 30))
    return rows, dict(hits)
