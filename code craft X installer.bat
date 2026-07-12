@echo off
echo codecraft X installer
pause

:ask_path
set /p target_path="Enter the installation path (e.g., C:\MinGW_Dev): "
color 2

if "%target_path%"=="" (
    echo Path cannot be empty. Please try again.
    goto ask_path
)

echo.
echo Target path: %target_path%
echo Creating directory and starting download...
echo.

if not exist "%target_path%" (
    mkdir "%target_path%"
)

cd /d "%target_path%"

git init .
git remote add origin https://github.com/ywsa-dev/codecraftX
git sparse-checkout init --cone
git sparse-checkout set /* !/mingw64/
git pull origin main

curl -L -o mingw.zip https://github.com/brechtsanders/winlibs_mingw/releases/download/14.2.0posix-18.1.8-12.0.0-msvcrt-r1/winlibs-x86_64-posix-seh-gcc-14.2.0-mingw-w64msvcrt-12.0.0-r1.zip
tar -xf mingw.zip
del mingw.zip

color 7
rmdir /s /q .git
echo finish download!
pause