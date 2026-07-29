"""Phase 4 step 2: LLM-name each course's topic/subtopic clusters.

One API call per course: given the course name and its clustered question
groups (with a couple of representative questions each), the model returns a
chapter-level TOPIC per topic-group and a specific SUBTOPIC per leaf cluster.
Cheap (only cluster reps are sent, not all questions). Concurrent, resumable
(skips courses already in topic_labels.jsonl), hard cost cap.

Usage:
  python scripts/label_topics.py --limit 20        # pilot, measure cost
  python scripts/label_topics.py --workers 8 --cap 1.30
"""

import argparse
import json
import os
import sqlite3
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

REPO = Path(__file__).resolve().parent.parent
load_dotenv(REPO / ".env")
API_KEY = os.getenv("OPEN_AI_API_KEY") or os.getenv("OPENAI_API_KEY")
MODEL = "gpt-4o-mini"

CLUSTERS = REPO / "DERIVED_DATA" / "topic_clusters.json"
OUT = REPO / "DERIVED_DATA" / "topic_labels.jsonl"
PRICE_IN, PRICE_OUT = 0.15, 0.60

SYSTEM = (
    "You name topic clusters for a specific college course's exam questions. "
    "You are given topic-groups, each containing one or more question clusters "
    "with sample questions. For each topic-group give a concise, standard "
    "chapter-level TOPIC name for that subject (e.g. 'Laplace Transforms', "
    "'Process Scheduling'). For each question cluster give a specific SUBTOPIC "
    "name (e.g. 'Inverse Laplace by partial fractions'). Use conventional "
    "syllabus terminology for the subject. Keep names short (2-6 words), no "
    "numbering, no course code."
)

SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "topics": {"type": "object", "additionalProperties": {"type": "string"}},
        "subtopics": {"type": "object", "additionalProperties": {"type": "string"}},
    },
    "required": ["topics", "subtopics"],
}
RESPONSE_FORMAT = {"type": "json_schema",
                   "json_schema": {"name": "topics", "strict": False, "schema": SCHEMA}}


def build_prompt(course_name, code, plan):
    groups = {}
    for lf in plan["leaves"]:
        groups.setdefault(lf["t"], []).append(lf)
    lines = [f"Course: {course_name or code} ({code})", "", "Topic groups:"]
    for t in sorted(groups):
        lines.append(f"[topic {t}]")
        for lf in sorted(groups[t], key=lambda x: x["s"]):
            reps = "  ||  ".join(lf["reps"])
            lines.append(f"  cluster {t}-{lf['s']}: {reps}")
    # Spell out the exact keys wanted. A '<t>' placeholder let the model answer
    # with its own topic names as keys, or merge groups and return fewer topics
    # than there are clusters — both of which lose labels downstream.
    tkeys = ", ".join(f'"{t}"' for t in sorted(groups))
    skeys = ", ".join(f'"{t}-{lf["s"]}"'
                      for t in sorted(groups)
                      for lf in sorted(groups[t], key=lambda x: x["s"]))
    lines.append("")
    lines.append("Return JSON with exactly these keys, using these numeric ids "
                 "verbatim — do not rename, merge, add or omit any:")
    lines.append(f'  "topics"    keys: {tkeys}')
    lines.append(f'  "subtopics" keys: {skeys}')
    lines.append('Example: {"topics": {"0": "Laplace Transforms"}, '
                 '"subtopics": {"0-1": "Inverse Laplace by partial fractions"}}')
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--cap", type=float, default=1.30)
    args = ap.parse_args()

    if not API_KEY:
        raise SystemExit("No API key")
    # per-request timeout so a stalled connection fails fast and retries
    # instead of blocking a worker forever; SDK-level retries off (we retry).
    client = OpenAI(api_key=API_KEY, timeout=40.0, max_retries=0)

    clusters = json.loads(CLUSTERS.read_text(encoding="utf-8"))
    con = sqlite3.connect(REPO / "DERIVED_DATA" / "papers_v2.db")
    names = dict(con.execute("SELECT course_code, course_name FROM papers"))
    con.close()

    done = set()
    if OUT.exists():
        for line in OUT.read_text(encoding="utf-8").splitlines():
            if line.strip():
                done.add(json.loads(line)["cc"])
    todo = [(cc, p) for cc, p in clusters.items() if cc not in done]
    if args.limit:
        todo = todo[:args.limit]
    print(f"courses {len(clusters)} | done {len(done)} | to label {len(todo)}")

    lock = threading.Lock()
    st = {"in": 0, "out": 0, "ok": 0, "err": 0, "n": 0, "stop": False}
    fh = OUT.open("a", encoding="utf-8")

    def work(cc, plan):
        prompt = build_prompt(names.get(cc), cc, plan)
        for attempt in range(4):
            try:
                r = client.chat.completions.create(
                    model=MODEL, temperature=0, max_tokens=3000,
                    response_format=RESPONSE_FORMAT,
                    messages=[{"role": "system", "content": SYSTEM},
                              {"role": "user", "content": prompt}])
                data = json.loads(r.choices[0].message.content)
                return cc, data, r.usage.prompt_tokens, r.usage.completion_tokens, None
            except Exception as e:
                if attempt == 3:
                    return cc, None, 0, 0, str(e)[:150]
                time.sleep(2 ** attempt)

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(work, cc, p): cc for cc, p in todo}
        for fut in as_completed(futs):
            cc, data, ti, to, err = fut.result()
            with lock:
                st["n"] += 1
                st["in"] += ti
                st["out"] += to
                if err:
                    st["err"] += 1
                else:
                    st["ok"] += 1
                    fh.write(json.dumps({"cc": cc,
                                         "topics": data.get("topics") or {},
                                         "subtopics": data.get("subtopics") or {}},
                                        ensure_ascii=False) + "\n")
                    fh.flush()
                cost = (st["in"] * PRICE_IN + st["out"] * PRICE_OUT) / 1e6
                if st["n"] % 50 == 0 or st["n"] == len(todo):
                    rate = st["n"] / (time.time() - t0)
                    eta = (len(todo) - st["n"]) / rate / 60 if rate else 0
                    print(f"  {st['n']}/{len(todo)} ok={st['ok']} err={st['err']} "
                          f"${cost:.3f} {rate:.1f}/s eta {eta:.0f}m", flush=True)
                if cost >= args.cap and not st["stop"]:
                    st["stop"] = True
                    print(f"\n!! cost cap ${args.cap} hit — stopping (resume to continue)")
                    for f in futs:
                        f.cancel()
                    break
    fh.close()
    cost = (st["in"] * PRICE_IN + st["out"] * PRICE_OUT) / 1e6
    print(f"\ndone: {st['n']} ok {st['ok']} err {st['err']}  cost ${cost:.4f}")
    if args.limit:
        full = cost / max(st["n"], 1) * len(clusters)
        print(f"--> extrapolated full ({len(clusters)} courses): ~${full:.2f}")


if __name__ == "__main__":
    main()
