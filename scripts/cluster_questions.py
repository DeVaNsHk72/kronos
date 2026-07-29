"""Phase 4 step 1: cluster each course's questions into topic -> subtopic groups.

Uses the precomputed embeddings. For every course code we cluster its DISTINCT
question embeddings into K topics, then sub-cluster each topic into subtopics.
No LLM here — purely numerical and free. Emits a plan the labeling step names.

Output: DERIVED_DATA/topic_clusters.json
  { course_code: { "n": int,
                   "leaves": [ {"t": topic_idx, "s": sub_idx,
                                "reps": [texts...], "hashes": [...]} ] } }

k scales with question count; tiny courses collapse to a single group.
"""

import json
import re
import hashlib
import sqlite3
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parent.parent
DB = REPO / "DERIVED_DATA" / "questions_v2.db"
EMB = REPO / "DERIVED_DATA" / "embeddings.npy"
KEYS = REPO / "DERIVED_DATA" / "emb_keys.json"
OUT = REPO / "DERIVED_DATA" / "topic_clusters.json"

MIN_TO_CLUSTER = 6          # fewer distinct questions -> one topic
REPS = 2                    # representative questions per leaf for the LLM


def norm(t):
    return re.sub(r"\s+", " ", (t or "").lower()).strip()


def text_hash(t):
    return hashlib.sha1(norm(t).encode("utf-8")).hexdigest()[:16]


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def kmeans(X, k):
    from sklearn.cluster import KMeans
    k = min(k, len(X))
    if k <= 1:
        return np.zeros(len(X), dtype=int), np.array([X.mean(0)])
    km = KMeans(n_clusters=k, n_init=3, random_state=0).fit(X)
    return km.labels_, km.cluster_centers_


def reps_near(X, texts, center, n):
    d = ((X - center) ** 2).sum(1)
    order = np.argsort(d)[:n]
    return [texts[i][:180] for i in order]


def main():
    embs = np.load(EMB).astype(np.float32)
    keys = json.loads(KEYS.read_text(encoding="utf-8"))
    idx = {h: i for i, h in enumerate(keys)}

    con = sqlite3.connect(DB)
    rows = con.execute(
        "SELECT course_code, question_md FROM questions "
        "WHERE course_code IS NOT NULL AND question_md IS NOT NULL").fetchall()
    con.close()

    # course -> distinct {hash: text}
    courses = {}
    for cc, txt in rows:
        h = text_hash(txt)
        courses.setdefault(cc, {}).setdefault(h, norm(txt))

    out = {}
    done = 0
    for cc, hmap in courses.items():
        hashes = [h for h in hmap if h in idx]
        if not hashes:
            continue
        X = embs[[idx[h] for h in hashes]]
        texts = [hmap[h] for h in hashes]
        n = len(hashes)

        leaves = []
        if n < MIN_TO_CLUSTER:
            leaves.append({"t": 0, "s": 0,
                           "reps": [t[:180] for t in texts[:REPS]],
                           "hashes": hashes})
        else:
            k_topic = clamp(round(n / 15), 2, 10)
            tlabels, _ = kmeans(X, k_topic)
            for t in sorted(set(tlabels)):
                mask = tlabels == t
                Xt, ht = X[mask], [hashes[i] for i in np.where(mask)[0]]
                tt = [texts[i] for i in np.where(mask)[0]]
                k_sub = clamp(round(len(ht) / 6), 1, 4)
                slabels, scenters = kmeans(Xt, k_sub)
                for s in sorted(set(slabels)):
                    smask = slabels == s
                    Xs = Xt[smask]
                    hs = [ht[i] for i in np.where(smask)[0]]
                    ts = [tt[i] for i in np.where(smask)[0]]
                    leaves.append({
                        "t": int(t), "s": int(s),
                        "reps": reps_near(Xs, ts, scenters[s], REPS),
                        "hashes": hs})
        out[cc] = {"n": n, "leaves": leaves}
        done += 1
        if done % 400 == 0:
            print(f"  clustered {done}/{len(courses)} courses...")

    OUT.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    tot_leaves = sum(len(v["leaves"]) for v in out.values())
    print(f"courses clustered : {len(out)}")
    print(f"total leaf groups : {tot_leaves}  (avg {tot_leaves/len(out):.1f}/course)")
    print(f"-> {OUT}")


if __name__ == "__main__":
    main()
