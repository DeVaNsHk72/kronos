"""Phase 5 core (also feeds Phase 4 topics): embed every distinct question.

Embeds the DISTINCT normalized question texts with a local sentence-transformer
(bge-small-en-v1.5, 384-dim) on CPU. Duplicates (same text repeated across
years) are embedded once and shared. Outputs:

  DERIVED_DATA/embeddings.npy    float16  [N_distinct x 384]  (L2-normalized)
  DERIVED_DATA/emb_keys.json     list of N_distinct text-hashes, row-aligned

Re-runnable; skips work if outputs already exist unless --force.
"""

import argparse
import hashlib
import json
import re
import sqlite3
import sys
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parent.parent
DB = REPO / "DERIVED_DATA" / "questions_v2.db"
EMB = REPO / "DERIVED_DATA" / "embeddings.npy"
KEYS = REPO / "DERIVED_DATA" / "emb_keys.json"
MODEL = "BAAI/bge-small-en-v1.5"


def norm(t):
    return re.sub(r"\s+", " ", (t or "").lower()).strip()


def text_hash(t):
    return hashlib.sha1(norm(t).encode("utf-8")).hexdigest()[:16]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--batch", type=int, default=256)
    args = ap.parse_args()

    if EMB.exists() and KEYS.exists() and not args.force:
        sys.exit("embeddings already exist; pass --force to rebuild")

    con = sqlite3.connect(DB)
    rows = con.execute(
        "SELECT question_md FROM questions WHERE question_md IS NOT NULL").fetchall()
    con.close()

    # distinct normalized texts, keep first raw form for embedding
    uniq = {}
    for (txt,) in rows:
        h = text_hash(txt)
        if h not in uniq:
            uniq[h] = norm(txt)
    keys = list(uniq.keys())
    texts = [uniq[k] for k in keys]
    print(f"questions: {len(rows)}  distinct texts: {len(texts)}")

    from sentence_transformers import SentenceTransformer
    print(f"loading {MODEL} (CPU)...")
    model = SentenceTransformer(MODEL, device="cpu")

    embs = model.encode(
        texts, batch_size=args.batch, show_progress_bar=True,
        normalize_embeddings=True, convert_to_numpy=True)
    embs = embs.astype(np.float16)

    np.save(EMB, embs)
    KEYS.write_text(json.dumps(keys), encoding="utf-8")
    print(f"saved {embs.shape} -> {EMB.name}, {len(keys)} keys -> {KEYS.name}")


if __name__ == "__main__":
    main()
