@echo off
cd /d "C:\Users\Biswanath Bag\OneDrive\Desktop\Hotel-ERP"
del /f /q md-list.txt md-disk-list.txt test-candidates.txt test-tracked.txt tracked-files.txt
del /f /q build-run.bat frontend-build.log frontend-build-err.log build-result.txt backend_verify.py backend-verify-result.txt verify-result.txt 2>nul
git --no-pager status --short > cleanup-status.txt
del /f /q cleanup-runner.bat 2>nul
