"""Stage PDFs as {sha}.pdf for upload to Hugging Face.

Reads papers_v2.db, resolves each paper's first existing original path under
PAPERS_ROOT, and hard-links (falls back to copy) it into STAGE/ as {sha}.pdf.
"""

import json
import os
import shutil
import sqlite3
from pathlib import Path

from dotenv import load_dotenv

REPO = Path(__file__).resolve().parents[1]
load_dotenv(REPO / ".env")

RIPPED = Path(os.environ["PAPERS_ROOT"])
DB = REPO / "DERIVED_DATA" / "papers_v2.db"
STAGE = Path(r"E:\pdf_stage")

STAGE.mkdir(exist_ok=True)
con = sqlite3.connect(DB)
rows = con.execute("SELECT sha, original_paths FROM papers").fetchall()

done = missing = 0
for sha, paths in rows:
    dst = STAGE / f"{sha}.pdf"
    if dst.exists():
        done += 1
        continue
    for rel in (json.loads(paths) if paths else []):
        src = RIPPED / rel
        if src.is_file():
            try:
                os.link(src, dst)  # hard link: no extra disk space
            except OSError:
                shutil.copy2(src, dst)
            done += 1
            break
    else:
        missing += 1

print(f"staged {done}, missing {missing}, total {len(rows)}")
