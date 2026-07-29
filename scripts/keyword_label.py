"""Free (no-API) fallback labeling for courses the LLM didn't reach.

For every course NOT already in topic_labels.jsonl, derive topic/subtopic names
from each cluster's most distinctive terms (TF-IDF over the course's clusters,
bigram-preferring, exam command-words filtered). Appends rows in the same
format as the LLM labeler (with "src":"kw") so apply_topics.py works unchanged.

Re-runnable: skips courses already labeled (LLM or kw).
"""

import json
import re
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer, ENGLISH_STOP_WORDS

REPO = Path(__file__).resolve().parent.parent
CLUSTERS = REPO / "DERIVED_DATA" / "topic_clusters.json"
OUT = REPO / "DERIVED_DATA" / "topic_labels.jsonl"

# exam/question verbs and filler that are not topical
CMD = {
    "explain", "define", "derive", "find", "obtain", "write", "state", "list",
    "describe", "calculate", "determine", "show", "prove", "discuss", "give",
    "draw", "sketch", "consider", "following", "given", "figure", "fig",
    "shown", "using", "use", "solve", "evaluate", "compute", "brief", "briefly",
    "short", "note", "notes", "example", "examples", "differentiate", "compare",
    "mention", "illustrate", "outline", "let", "hence", "value", "values",
    "question", "answer", "marks", "unit", "b", "c", "d", "e", "f", "g",
    "following", "respect", "various", "different", "types", "type", "based",
    "system", "systems", "method", "methods", "term", "terms",
}
STOP = ENGLISH_STOP_WORDS.union(CMD)
WORD = re.compile(r"[a-z]{3,}")


def titlecase(s):
    small = {"of", "and", "in", "to", "for", "the", "by", "with", "a", "an", "on"}
    ws = s.split()
    return " ".join(w if w in small and i else w.capitalize()
                    for i, w in enumerate(ws))


def top_terms(vec, X, rowvec, n=2):
    terms = vec.get_feature_names_out()
    order = rowvec.argsort()[::-1]
    picked, seen = [], set()
    # prefer bigrams, then unigrams; skip if a word already covered
    for grp in (2, 1):
        for i in order:
            if rowvec[i] <= 0:
                break
            t = terms[i]
            if len(t.split()) != grp:
                continue
            words = set(t.split())
            if words & seen:
                continue
            picked.append(t)
            seen |= words
            if len(picked) >= n:
                return picked
    return picked


def name_for(texts):
    """A single fallback name from raw text when TF-IDF yields nothing."""
    words = [w for w in WORD.findall(" ".join(texts).lower()) if w not in STOP]
    from collections import Counter
    c = Counter(words)
    return titlecase(" ".join(w for w, _ in c.most_common(2))) or "General"


def label_course(plan):
    leaves = plan["leaves"]
    docs = [" ".join(lf["reps"]) or " " for lf in leaves]
    try:
        vec = TfidfVectorizer(stop_words=list(STOP), ngram_range=(1, 2),
                              min_df=1, token_pattern=r"[a-z]{3,}")
        X = vec.fit_transform([d.lower() for d in docs]).toarray()
    except ValueError:
        X = None

    subs = {}
    for i, lf in enumerate(leaves):
        if X is not None and X[i].sum() > 0:
            terms = top_terms(vec, X, X[i], n=2)
            subs[i] = titlecase(" ".join(terms)) if terms else name_for(lf["reps"])
        else:
            subs[i] = name_for(lf["reps"])

    # topic name per topic-group = distinctive terms across its leaves
    topics = {}
    groups = {}
    for i, lf in enumerate(leaves):
        groups.setdefault(lf["t"], []).append(i)
    for t, ids in groups.items():
        if X is not None:
            agg = X[ids].sum(0)
            terms = top_terms(vec, X, agg, n=2)
            topics[t] = titlecase(" ".join(terms)) if terms else \
                name_for([r for i in ids for r in leaves[i]["reps"]])
        else:
            topics[t] = name_for([r for i in ids for r in leaves[i]["reps"]])

    topics_out = {str(t): v for t, v in topics.items()}
    subs_out = {f"{leaves[i]['t']}-{leaves[i]['s']}": v for i, v in subs.items()}
    return topics_out, subs_out


def main():
    clusters = json.loads(CLUSTERS.read_text(encoding="utf-8"))
    done = set()
    if OUT.exists():
        for line in OUT.read_text(encoding="utf-8").splitlines():
            if line.strip():
                done.add(json.loads(line)["cc"])
    todo = [(cc, p) for cc, p in clusters.items() if cc not in done]
    print(f"courses {len(clusters)} | already labeled {len(done)} | keyword-labeling {len(todo)}")

    with OUT.open("a", encoding="utf-8") as fh:
        for i, (cc, plan) in enumerate(todo, 1):
            topics, subs = label_course(plan)
            fh.write(json.dumps({"cc": cc, "topics": topics, "subtopics": subs,
                                 "src": "kw"}, ensure_ascii=False) + "\n")
            if i % 500 == 0:
                print(f"  {i}/{len(todo)}...")
    print(f"done — total labeled now: {len(done)+len(todo)}/{len(clusters)}")


if __name__ == "__main__":
    main()
