# Full-corpus OCR pipeline — run this in PowerShell.
# Resumable: if it stops for ANY reason (Ctrl+C, closed window, crash, reboot),
# just run it again — it skips everything already finished.
# All output is appended to D:\bmsce-paper-ripper\scripts\ocr_run.log as it goes.

Write-Host "Starting OCR pipeline (log: D:\bmsce-paper-ripper\scripts\ocr_run.log)"
Write-Host "If this window closes or you press Ctrl+C, just run the script again to resume."
Write-Host ""

wsl.exe -d Ubuntu-24.04 -- bash /mnt/d/bmsce-paper-ripper/scripts/run_ocr_all.sh

Write-Host ""
Write-Host "Pipeline exited. Check the tail of the log above; re-run this script to resume if it stopped early."
