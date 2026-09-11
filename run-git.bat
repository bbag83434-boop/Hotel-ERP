@echo off
cd /d "C:\Users\Biswanath Bag\OneDrive\Desktop\Hotel-ERP"
echo === GIT ADD ===
git add -A
echo === GIT STATUS (short) ===
git status --short
echo === GIT COMMIT ===
git commit -m "chore: remove test files, markdown docs, and stale work36 artifacts

- Delete 34 test files and 50 markdown documentation files
- Remove obsolete test:backend script from package.json
- Delete stale work36/ directory and its .git-backup
- Delete scratch_pg/ test scripts and ops/ markdown files
- Include cleanup audit report and dev convenience scripts"
echo === GIT PUSH ===
git push
echo === DONE ===
