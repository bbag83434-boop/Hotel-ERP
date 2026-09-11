@echo off
cd /d "C:\Users\Biswanath Bag\OneDrive\Desktop\Hotel-ERP\frontend"
npm run build > "C:\Users\Biswanath Bag\OneDrive\Desktop\Hotel-ERP\frontend-build.log" 2>&1
echo BUILD_EXIT=%ERRORLEVEL% > "C:\Users\Biswanath Bag\OneDrive\Desktop\Hotel-ERP\build-result.txt"

