@echo off
curl -L -o mingw.zip https://github.com/brechtsanders/winlibs_mingw/releases/download/14.2.0posix-18.1.8-12.0.0-msvcrt-r1/winlibs-x86_64-posix-seh-gcc-14.2.0-mingw-w64msvcrt-12.0.0-r1.zip
tar -xf mingw.zip
del mingw.zip
