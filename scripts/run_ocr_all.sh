#!/bin/bash
# Full-corpus OCR pipeline. Safe to re-run at any time: every stage skips
# work that is already on disk, so a killed/closed run resumes where it left off.
#
# Stage 1: light PyMuPDF extraction (CPU) -> ~/ocr/light_out       (6,763 pdfs)
# Stage 2: Marker on math-heavy text pdfs -> ~/ocr/marker_out      (1,308 pdfs)
# Stage 3: Marker on scanned pdfs         -> ~/ocr/marker_out      (2,552 pdfs)
# (220 fake PDFs — saved 404 HTML pages — removed; DERIVED_DATA/fake_pdfs_report.json)
#
# Everything is logged (append) to /mnt/d/bmsce-paper-ripper/scripts/ocr_run.log
set -u

LOG=/mnt/d/bmsce-paper-ripper/scripts/ocr_run.log
exec > >(tee -a "$LOG") 2>&1

echo ""
echo "############################################################"
echo "### OCR pipeline run started: $(date)"
echo "############################################################"

source /home/yash/olmocr-env/bin/activate

export RECOGNITION_BATCH_SIZE=96
export DETECTOR_BATCH_SIZE=12
export LAYOUT_BATCH_SIZE=12
export TABLE_REC_BATCH_SIZE=12

echo ""
echo "=== STAGE 1/3: light extraction (CPU, PyMuPDF) — $(date) ==="
python3 /mnt/d/bmsce-paper-ripper/scripts/extract_light.py

echo ""
echo "=== STAGE 2/3: Marker on math-heavy text PDFs (watchdog) — $(date) ==="
python3 /mnt/d/bmsce-paper-ripper/scripts/marker_watchdog.py /home/yash/ocr/pdfs_marker_text 2 2>&1 | tr '\r' '\n'

echo ""
echo "=== STAGE 3/3: Marker on scanned PDFs (watchdog) — $(date) ==="
python3 /mnt/d/bmsce-paper-ripper/scripts/marker_watchdog.py /home/yash/ocr/pdfs_scanned 2 2>&1 | tr '\r' '\n'

echo ""
echo "=== FINAL COUNTS — $(date) ==="
echo "light_out  folders: $(ls /home/yash/ocr/light_out 2>/dev/null | wc -l)  (target 6763)"
echo "marker_out folders: $(ls /home/yash/ocr/marker_out 2>/dev/null | wc -l)  (target 3860)"
echo "############################################################"
echo "### OCR pipeline run finished: $(date)"
echo "############################################################"
