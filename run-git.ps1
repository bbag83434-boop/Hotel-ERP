$ErrorActionPreference = "Continue"
Set-Location "C:\Users\Biswanath Bag\OneDrive\Desktop\Hotel-ERP"

$output = @()
$output += "=== GIT ADD ==="
git add -A 2>&1
$output += "git add exit code: $LASTEXITCODE"

$output += ""
$output += "=== GIT STATUS ==="
git status --short 2>&1
$output += "git status exit code: $LASTEXITCODE"

$output += ""
$output += "=== GIT COMMIT ==="
$commitMessage = "chore: remove test files, markdown docs, and stale work36 artifacts`n`n- Delete 34 test files and 50 markdown documentation files`n- Remove obsolete test:backend script from package.json`n- Delete stale work36/ directory and its .git-backup`n- Delete scratch_pg/ test scripts and ops/ markdown files`n- Include cleanup audit report and dev convenience scripts"
git commit -m $commitMessage 2>&1
$output += "git commit exit code: $LASTEXITCODE"

$output += ""
$output += "=== GIT PUSH ==="
git push 2>&1
$output += "git push exit code: $LASTEXITCODE"

$output += ""
$output += "=== DONE ==="

$output | Out-File -FilePath "C:\Users\Biswanath Bag\OneDrive\Desktop\Hotel-ERP\git-output.log" -Encoding UTF8
Write-Output "Script completed, check git-output.log for results"
