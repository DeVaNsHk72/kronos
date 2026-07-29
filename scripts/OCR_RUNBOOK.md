# OCR Re-extraction Runbook (olmOCR-2, everything on the A5000 machine)

Goal: re-extract all ~11,462 PDFs (text + scanned) through olmOCR-2 into
`DERIVED_DATA/extracted_text_v2/`, one JSON per sha256, with quality scores.

Model: `allenai/olmOCR-2-7B-1025-FP8` — Qwen2.5-VL-7B fine-tuned for document
OCR, FP8 quantized, fits the A5000's 24 GB. Downloaded automatically on first
run.

The entire pipeline runs on the GPU machine. Only two transfers happen:
the project folder over (once), and `DERIVED_DATA/extracted_text_v2/` back
(small) if the main copy of the project stays on the old machine.

## Step 0 — copy the project to the GPU machine

Copy the whole `bmsce-paper-ripper` folder (must include `RIPPED_PAPERS/`,
`scripts/`, and ideally `DERIVED_DATA/extracted_text/` — the v1 data improves
pilot selection) to any drive on the A5000 machine, e.g. `D:\bmsce-paper-ripper`.

## Step 1 — one-time WSL2 setup (Windows side)

olmOCR's inference stack (vLLM) is Linux-only, so it runs inside WSL2.
PowerShell **as Administrator**, then reboot:

```powershell
wsl --install -d Ubuntu-24.04
```

Requirements: normal NVIDIA Windows driver installed (`nvidia-smi` works in
PowerShell), virtualization enabled in BIOS. Do NOT install any NVIDIA driver
inside Ubuntu — WSL2 uses the Windows one.

## Step 2 — run the pipeline (inside the Ubuntu app)

The repo on `D:` is visible as `/mnt/d/bmsce-paper-ripper`. All commands run
from there:

```bash
cd /mnt/d/bmsce-paper-ripper

bash scripts/run_all.sh all
```

`all` runs three stages and then stops on purpose:

1. **setup** — apt packages, Python venv at `~/olmocr-env`, olmocr install,
   GPU visibility check.
2. **export** — hashes every PDF, copies them as `<sha256>.pdf` into `~/ocr/pdfs`
   (WSL-local disk — much faster than /mnt for the OCR run), writes
   `~/ocr/manifest.jsonl`, picks 20 pilot papers into `~/ocr/pilot`.
3. **pilot** — OCRs the 20 pilot papers into `~/ocr/workspace_pilot`.

**Review the pilot output** before committing to the full run:

```bash
less ~/ocr/workspace_pilot/markdown/*.md
```

Check: equations came out as LaTeX, tables intact, marks attached to their
questions, scanned papers readable.

## Step 3 — full run

```bash
tmux new -s ocr
cd /mnt/d/bmsce-paper-ripper && bash scripts/run_all.sh full
# detach: Ctrl+B then D   |   reattach: tmux attach -t ocr
```

Expect roughly 12–30 h for ~35k pages. Fully resumable: if anything dies,
rerun the same command and it continues where it stopped.

## Step 4 — convert + requeue

```bash
bash scripts/run_all.sh convert   # writes DERIVED_DATA/extracted_text_v2/
bash scripts/run_all.sh requeue   # second pass on missing/low-quality papers
```

`convert` produces:
- `DERIVED_DATA/extracted_text_v2/<sha256>.json` — markdown + quality score
- `DERIVED_DATA/ocr_v2_report.json` — counts + `requeue` list

`requeue` stages the flagged PDFs, re-OCRs them into a fresh workspace, and
converts again (overwriting their v2 files with the fresh result). Repeat if
the report still lists stragglers; a handful of genuinely broken PDFs may
remain — inspect those manually.

## Step 5 — sync back (only if the main project copy is elsewhere)

`DERIVED_DATA/extracted_text_v2/` + `ocr_v2_report.json` are the only outputs;
copy them back to the main machine's `DERIVED_DATA/`.

## Notes

- v1 extraction (`DERIVED_DATA/extracted_text/`) stays untouched for diffing.
- Diagrams come back as short descriptions/placeholders, not images.
- `OCR_HOME` env var overrides the `~/ocr` working dir if that disk is tight
  (needs ~2x the corpus size: copies + workspace).
- Next stage after this: parse `extracted_text_v2` markdown into structured
  questions (unit, number, subpart, marks) and rebuild `questions.db`.
