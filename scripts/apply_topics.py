"""Phase 4 step 3: write topic/subtopic labels into questions_v2.db.

Joins the cluster plan (topic_clusters.json) with the LLM labels
(topic_labels.jsonl): each leaf cluster -> (topic, subtopic) name for its
course. Builds a `topics(id, course_code, topic, subtopic)` table, adds
`topic_id`, `topic`, `subtopic` to `questions`, and assigns every question via
its text hash. Unlabeled clusters fall back to topic 'General'.

Re-runnable (drops and rebuilds the topic assignment).
"""

import hashlib
import json
import re
import sqlite3
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DB = REPO / "DERIVED_DATA" / "questions_v2.db"
CLUSTERS = REPO / "DERIVED_DATA" / "topic_clusters.json"
LABELS = REPO / "DERIVED_DATA" / "topic_labels.jsonl"


def norm(t):
    return re.sub(r"\s+", " ", (t or "").lower()).strip()


def text_hash(t):
    return hashlib.sha1(norm(t).encode("utf-8")).hexdigest()[:16]


def main():
    clusters = json.loads(CLUSTERS.read_text(encoding="utf-8"))
    labels = {}
    for line in LABELS.read_text(encoding="utf-8").splitlines():
        if line.strip():
            d = json.loads(line)
            labels[d["cc"]] = d

    con = sqlite3.connect(DB)
    con.executescript("""
        DROP TABLE IF EXISTS topics;
        CREATE TABLE topics(id INTEGER PRIMARY KEY, course_code TEXT,
                            topic TEXT, subtopic TEXT);
    """)
    for col in ("topic_id INTEGER", "topic TEXT", "subtopic TEXT"):
        name = col.split()[0]
        if name not in {r[1] for r in con.execute("PRAGMA table_info(questions)")}:
            con.execute(f"ALTER TABLE questions ADD COLUMN {col}")

    def normalize_labels(lab, tset):
        """Map the model's reply onto cluster indices.

        Two key styles come back. Usually the cluster index ('0', 'topic-0',
        '0-1'). But sometimes the model keys by the topic name it just invented
        ('Volume Calculations', 'Volume Calculations-1'), and scanning those for
        digits finds none — which silently dropped every label for the course.
        Detect the style first, then parse accordingly.
        """
        tops = lab.get("topics") or {}
        subs = lab.get("subtopics") or {}

        def idx(k):
            # full match, so a name like 'Unit 2 Basics' is not read as index 2
            m = re.fullmatch(r"\D*(\d+)", str(k).strip())
            return int(m.group(1)) if m else None

        tmap, smap = {}, {}
        if tops and all(idx(k) is not None for k in tops):
            for k, v in tops.items():
                tmap[idx(k)] = v
            for k, v in subs.items():
                nums = re.findall(r"\d+", str(k))
                if len(nums) >= 2:
                    smap[(int(nums[0]), int(nums[1]))] = v
            return tmap, smap

        # name-keyed: the prompt lists groups in sorted order and the model
        # answers in that order, so position recovers the index — but only when
        # the counts line up. Anything else is ambiguous and left unlabelled.
        order = sorted(tset)
        if len(tops) != len(order):
            return {}, {}
        name_to_t = {}
        for t, (k, v) in zip(order, tops.items()):
            tmap[t] = v
            name_to_t[str(k).strip().lower()] = t
        for k, v in subs.items():
            pre, _, tail = str(k).strip().rpartition("-")
            if not tail.strip().isdigit():
                continue
            pre = pre.strip()
            t = name_to_t.get(pre.lower())
            if t is None and pre.isdigit():
                t = int(pre)
            if t is not None:
                smap[(t, int(tail.strip()))] = v
        return tmap, smap

    topic_id = {}          # (cc, topic, subtopic) -> id
    hash_topic = {}        # (cc, hash) -> id
    next_id = 1
    for cc, plan in clusters.items():
        tmap, smap = normalize_labels(labels.get(cc, {}),
                                      {lf["t"] for lf in plan["leaves"]})
        for lf in plan["leaves"]:
            topic = (tmap.get(lf["t"]) or "General").strip()
            sub = (smap.get((lf["t"], lf["s"])) or topic).strip()
            key = (cc, topic, sub)
            if key not in topic_id:
                topic_id[key] = next_id
                con.execute("INSERT INTO topics VALUES (?,?,?,?)",
                            (next_id, cc, topic, sub))
                next_id += 1
            tid = topic_id[key]
            for h in lf["hashes"]:
                hash_topic[(cc, h)] = tid

    id_meta = {tid: k for k, tid in topic_id.items()}
    upd = 0
    for qid, cc, txt in con.execute(
            "SELECT id, course_code, question_md FROM questions").fetchall():
        tid = hash_topic.get((cc, text_hash(txt)))
        if tid is None:
            continue
        _, topic, sub = id_meta[tid]
        con.execute("UPDATE questions SET topic_id=?, topic=?, subtopic=? WHERE id=?",
                    (tid, topic, sub, qid))
        upd += 1

    con.executescript("""
        CREATE INDEX IF NOT EXISTS ix_q_topicid ON questions(topic_id);
        CREATE INDEX IF NOT EXISTS ix_q_topic ON questions(topic);
        CREATE INDEX IF NOT EXISTS ix_topics_cc ON topics(course_code);
    """)
    con.commit()

    tot = con.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
    assigned = con.execute("SELECT COUNT(*) FROM questions WHERE topic_id IS NOT NULL").fetchone()[0]
    ntopics = con.execute("SELECT COUNT(*) FROM topics").fetchone()[0]
    dtopics = con.execute("SELECT COUNT(DISTINCT topic||course_code) FROM topics").fetchone()[0]
    con.close()
    print(f"topic rows (course,topic,subtopic) : {ntopics}")
    print(f"distinct (course,topic) pairs      : {dtopics}")
    print(f"questions assigned a topic         : {assigned}/{tot} ({assigned/tot:.1%})")


if __name__ == "__main__":
    main()
