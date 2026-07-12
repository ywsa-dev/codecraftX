const { app, BrowserWindow, ipcMain } = require('electron');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 700,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
    mainWindow.setTitle('Cpp Compiler');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

function getGppPath() {
    const gppPath = path.join(__dirname, 'mingw64', 'bin', 'g++.exe');
    
    if (fs.existsSync(gppPath)) {
        return gppPath;
    }
    
    return 'g++';
}

ipcMain.on('save-code', (event, code) => {
    try {
        fs.writeFileSync('compiler.cpp', code, 'utf8');
        event.reply('save-result', { success: true, message: 'Code saved!' });
    } catch (err) {
        event.reply('save-result', { success: false, message: err.message });
    }
});

ipcMain.on('compile-run', (event) => {
    const cppPath = path.join(__dirname, 'compiler.cpp');
    const exePath = path.join(__dirname, 'app', 'app.exe');
    const appDir = path.join(__dirname, 'app');

    if (!fs.existsSync(cppPath)) {
        event.reply('compile-result', { 
            success: false, 
            message: 'compiler.cpp not found!' 
        });
        return;
    }

    if (!fs.existsSync(appDir)) {
        fs.mkdirSync(appDir);
    }

    const gppPath = getGppPath();
    const compileCmd = `"${gppPath}" "${cppPath}" -o "${exePath}" -std=c++17 -O2`;

    // 🔥🔥🔥 디버깅용 출력 제거 (깨짐 방지)
    // console.log('Compiling with:', gppPath);  ← 주석 처리!
    // console.log('Command:', compileCmd);      ← 주석 처리!

    const mingwBin = path.join(__dirname, 'mingw64', 'bin');
    const env = {
        ...process.env,
        PATH: mingwBin + ';' + process.env.PATH
    };

    exec(compileCmd, { encoding: 'utf8', env: env }, (error, stdout, stderr) => {
        if (error) {
            event.reply('compile-result', { 
                success: false, 
                message: 'Compilation failed!', 
                error: stderr || error.message
            });
            return;
        }

        if (stderr) {
            event.reply('compile-result', { 
                success: true, 
                message: 'Compilation successful with warnings', 
                warning: stderr 
            });
        } else {
            event.reply('compile-result', { 
                success: true, 
                message: 'Compilation successful!' 
            });
        }

        if (fs.existsSync(exePath)) {
            event.reply('run-start', { message: 'Running app.exe...' });
            
            const runCmd = `start "" "${exePath}"`;
            
            exec(runCmd, { env: env }, (err, out, errOut) => {
                if (err) {
                    event.reply('run-finished', { 
                        code: err.code || -1,
                        message: 'Program exited with code ' + (err.code || -1),
                        errorDetail: err.message
                    });
                } else {
                    event.reply('run-finished', { 
                        code: 0,
                        message: 'Program finished successfully!'
                    });
                }
            });
        } else {
            event.reply('run-finished', { 
                code: -1,
                message: 'app.exe not found!',
                errorDetail: 'Executable not found at: ' + exePath
            });
        }
    });
});