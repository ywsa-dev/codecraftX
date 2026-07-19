const { app, BrowserWindow, ipcMain, Menu } = require('electron');
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
    mainWindow.setTitle('CodeCraft X');

    // =============================================
    // 상단 메뉴 설정
    // =============================================
    const menuTemplate = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New',
                    accelerator: 'Ctrl+N',
                    click: () => {
                        mainWindow.webContents.send('menu-new');
                    }
                },
                {
                    label: 'Open',
                    accelerator: 'Ctrl+O',
                    click: () => {
                        mainWindow.webContents.send('menu-open');
                    }
                },
                {
                    label: 'Save',
                    accelerator: 'Ctrl+S',
                    click: () => {
                        mainWindow.webContents.send('menu-save');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Exit',
                    accelerator: 'Ctrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { label: 'Undo', accelerator: 'Ctrl+Z', role: 'undo' },
                { label: 'Redo', accelerator: 'Ctrl+Y', role: 'redo' },
                { type: 'separator' },
                { label: 'Cut', accelerator: 'Ctrl+X', role: 'cut' },
                { label: 'Copy', accelerator: 'Ctrl+C', role: 'copy' },
                { label: 'Paste', accelerator: 'Ctrl+V', role: 'paste' },
                { type: 'separator' },
                { label: 'Select All', accelerator: 'Ctrl+A', role: 'selectAll' }
            ]
        },
        {
            label: 'Linker',
            submenu: [
                {
                    label: 'Library Paths (-L)',
                    click: () => {
                        mainWindow.webContents.send('menu-linker-librarypaths');
                    }
                },
                {
                    label: 'Libraries (-l)',
                    click: () => {
                        mainWindow.webContents.send('menu-linker-libraries');
                    }
                },
                {
                    label: 'Include Paths (-I)',
                    click: () => {
                        mainWindow.webContents.send('menu-linker-includepaths');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Extra Options',
                    click: () => {
                        mainWindow.webContents.send('menu-linker-extra');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Reset to Default',
                    click: () => {
                        mainWindow.webContents.send('menu-linker-reset');
                    }
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                { label: 'Reload', accelerator: 'Ctrl+R', role: 'reload' },
                { label: 'Toggle Full Screen', accelerator: 'F11', role: 'togglefullscreen' },
                { type: 'separator' },
                { label: 'Developer Tools', accelerator: 'F12', role: 'toggleDevTools' }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Documentation',
                    click: () => {
                        mainWindow.webContents.send('menu-help-docs');
                    }
                },
                {
                    label: 'About CodeCraft X',
                    click: () => {
                        mainWindow.webContents.send('menu-help-about');
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// =============================================
// 내장 g++ 경로 가져오기
// =============================================
function getGppPath() {
    const gppPath = path.join(__dirname, 'mingw64', 'bin', 'g++.exe');
    
    if (fs.existsSync(gppPath)) {
        return gppPath;
    }
    
    console.warn('⚠️ Built-in g++ not found, using system g++');
    return 'g++';
}

// =============================================
// 코드 저장
// =============================================
ipcMain.on('save-code', (event, code) => {
    try {
        fs.writeFileSync('compiler.cpp', code, 'utf8');
        event.reply('save-result', { success: true, message: 'Code saved!' });
    } catch (err) {
        event.reply('save-result', { success: false, message: err.message });
    }
});

// =============================================
// 컴파일 + 실행 (Linker 설정 포함)
// =============================================
ipcMain.on('compile-run', (event, linkerSettings) => {
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
    
    // Linker 설정 적용
    const settings = linkerSettings || {
        libraryPaths: [],
        libraries: [],
        includePaths: [],
        extraOptions: []
    };

    let compileCmd = `"${gppPath}" "${cppPath}" -o "${exePath}" -std=c++17 -O2`;

    settings.includePaths.forEach(p => {
        if (p) compileCmd += ` -I"${p}"`;
    });

    settings.libraryPaths.forEach(p => {
        if (p) compileCmd += ` -L"${p}"`;
    });

    settings.libraries.forEach(lib => {
        if (lib) compileCmd += ` -l${lib}`;
    });

    settings.extraOptions.forEach(opt => {
        if (opt) compileCmd += ` ${opt}`;
    });

    // 🔥🔥🔥 디버깅용 console.log 제거 (깨짐 방지)
    // console.log('Compiling with:', gppPath);
    // console.log('Command:', compileCmd);

    const mingwBin = path.join(__dirname, 'mingw64', 'bin');
    const env = {
        ...process.env,
        PATH: mingwBin + ';' + process.env.PATH
    };

    exec(compileCmd, { encoding: 'utf8', env: env }, (error, stdout, stderr) => {
        if (error) {
            console.error('Compilation error:', error);
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

        // 실행
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