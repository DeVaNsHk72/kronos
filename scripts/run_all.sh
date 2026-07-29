#!/usr/bin/env bash
# End-to-end OCR pipeline for the GPU machine. Run inside WSL2 Ubuntu.
#
# The repo (with RIPPED_PAPERS/) lives on a Windows drive, visible here
# under /mnt/<drive>/... . Heavy I/O (hash-named PDF copies, olmOCR
# workspace) goes to $OCR_HOME on the fast WSL-local filesystem; final
# results are written back into the repo's DERIVED_DATA.
#
# Usage:
#   bash scripts/run_all.sh setup     # one-time: apt deps + venv + olmocr
#   bash scripts/run_all.sh export    # package PDFs + pick 20 pilot papers
#   bash scripts/run_all.sh pilot     # OCR the 20 pilot papers, then review
#   bash scripts/run_all.sh full      # OCR everything (use tmux!)
#   bash scripts/run_all.sh convert   # write DERIVED_DATA/extracted_text_v2
#   bash scripts/run_all.sh all       # setup + export + pilot (stops for review)

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OCR_HOME="${OCR_HOME:-$HOME/ocr}"
VENV="${VENV:-$HOME/olmocr-env}"
MODEL="allenai/olmOCR-2-7B-1025-FP8"

activate() { source "$VENV/bin/activate"; }

do_setup() {
    echo "== setup: system packages, venv, olmocr =="
    sudo apt-get update
    sudo apt-get install -y poppler-utils tmux unzip python3-venv
    nvidia-smi >/dev/null || { echo "ERROR: GPU not visible in WSL (nvidia-smi failed)"; exit 1; }
    [ -d "$VENV" ] || python3 -m venv "$VENV"
    activate
    pip install --upgrade pip
    pip install pymupdf
    pip install olmocr[gpu] --extra-index-url https://download.pytorch.org/whl/cu128
    echo "== setup done =="
}

do_export() {
    echo "== export: packaging PDFs from $REPO_DIR to $OCR_HOME =="
    activate
    python "$REPO_DIR/scripts/ocr_export.py" --pilot 20 --dest "$OCR_HOME"
}

do_pilot() {
    echo "== pilot: OCR on 20 representative papers =="
    activate
    python -m olmocr.pipeline "$OCR_HOME/workspace_pilot" --markdown \
        --model "$MODEL" --gpu_memory_utilization 0.80 --enforce-eager --pdfs "$OCR_HOME"/pilot/*.pdf
    echo
    echo "Pilot done. Review the output before the full run:"
    echo "    ls $OCR_HOME/workspace_pilot/markdown/"
    echo "Check: equations as LaTeX, tables intact, marks with their questions."
    echo "Then:  bash scripts/run_all.sh full   (inside tmux: tmux new -s ocr)"
}

do_full() {
    if [ -z "${TMUX:-}" ]; then
        echo "WARNING: not inside tmux. The full run takes many hours;"
        echo "if this shell disconnects the run stops (it IS resumable by"
        echo "re-running this command). Recommended: tmux new -s ocr"
        read -r -p "Continue anyway? [y/N] " ans
        [ "${ans,,}" = "y" ] || exit 1
    fi
    echo "== full run: OCR on all PDFs =="
    activate
    python -m olmocr.pipeline "$OCR_HOME/workspace" --markdown \
        --model "$MODEL" --gpu_memory_utilization 0.80 --enforce-eager --pdfs "$OCR_HOME"/pdfs/*.pdf
}

do_convert() {
    echo "== convert: writing DERIVED_DATA/extracted_text_v2 =="
    activate
    python "$REPO_DIR/scripts/convert_olmocr_results.py" "$OCR_HOME/workspace" \
        --manifest "$OCR_HOME/manifest.jsonl"
    echo "Check DERIVED_DATA/ocr_v2_report.json for the requeue list."
}

do_requeue() {
    echo "== requeue: second pass on missing/low-quality papers =="
    activate
    python - "$REPO_DIR" "$OCR_HOME" <<'PY'
import json, shutil, sys
from pathlib import Path
repo, ocr = Path(sys.argv[1]), Path(sys.argv[2])
report = json.loads((repo / "DERIVED_DATA" / "ocr_v2_report.json").read_text())
shas = report.get("requeue", [])
dest = ocr / "requeue"
dest.mkdir(exist_ok=True)
for sha in shas:
    src = ocr / "pdfs" / f"{sha}.pdf"
    if src.exists():
        shutil.copy2(src, dest / src.name)
print(f"staged {len(shas)} PDFs in {dest}")
PY
    python -m olmocr.pipeline "$OCR_HOME/workspace_requeue" --markdown \
        --model "$MODEL" --gpu_memory_utilization 0.80 --enforce-eager --pdfs "$OCR_HOME"/requeue/*.pdf
    python "$REPO_DIR/scripts/convert_olmocr_results.py" "$OCR_HOME/workspace_requeue" \
        --manifest "$OCR_HOME/manifest.jsonl"
}

case "${1:-all}" in
    setup)   do_setup ;;
    export)  do_export ;;
    pilot)   do_pilot ;;
    full)    do_full ;;
    convert) do_convert ;;
    requeue) do_requeue ;;
    all)     do_setup; do_export; do_pilot ;;
    *)       echo "unknown stage: $1 (setup|export|pilot|full|convert|requeue|all)"; exit 1 ;;
esac