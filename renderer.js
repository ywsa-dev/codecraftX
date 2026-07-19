const { ipcRenderer } = require('electron');
const fs = require('fs');

// =============================================
// DOM Elements
// =============================================
const editor = document.getElementById('codeEditor');
const lineNumbers = document.getElementById('lineNumbers');
const outputContent = document.getElementById('outputContent');
const statusText = document.getElementById('statusText');
const statusTime = document.getElementById('statusTime');
const lineCount = document.getElementById('lineCount');
const runBtn = document.getElementById('runBtn');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');

// =============================================
// Default Code
// =============================================
const defaultCode = `#include <iostream>
#include <string>

int main() {
    std::cout << "Hello world!" << std::endl;
    return 0;
}`;

let originalCode = '';

// =============================================
// Linker Settings
// =============================================
let linkerSettings = {
    libraryPaths: [],
    libraries: [],
    includePaths: [],
    extraOptions: []
};

function loadLinkerSettings() {
    const saved = localStorage.getItem('linkerSettings');
    if (saved) {
        try {
            linkerSettings = JSON.parse(saved);
        } catch (e) {
            linkerSettings = { libraryPaths: [], libraries: [], includePaths: [], extraOptions: [] };
        }
    }
}

function saveLinkerSettings() {
    localStorage.setItem('linkerSettings', JSON.stringify(linkerSettings));
}

// =============================================
// Code Functions
// =============================================
function loadCode() {
    try {
        if (fs.existsSync('compiler.cpp')) {
            const code = fs.readFileSync('compiler.cpp', 'utf8');
            originalCode = removePauseFromCode(code);
            editor.value = originalCode;
        } else {
            originalCode = defaultCode;
            editor.value = defaultCode;
        }
    } catch (err) {
        originalCode = defaultCode;
        editor.value = defaultCode;
    }
    updateLineNumbers();
}

function removePauseFromCode(code) {
    const lines = code.split('\n');
    const result = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('Press any key') || line.includes('std::cin.get()')) {
            continue;
        }
        result.push(lines[i]);
    }
    return result.join('\n');
}

function addPauseForBuild(code) {
    if (code.includes('Press any key') || code.includes('std::cin.get()')) {
        return code;
    }

    const lines = code.split('\n');
    const result = [];
    let inMain = false;
    let braceCount = 0;
    let mainStart = -1;
    let mainEnd = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!inMain && line.includes('main') && line.includes('(') && line.includes(')')) {
            inMain = true;
            mainStart = i;
        }
        if (inMain) {
            for (const ch of line) {
                if (ch === '{') braceCount++;
                if (ch === '}') braceCount--;
            }
            if (braceCount === 0 && i > mainStart) {
                mainEnd = i;
                break;
            }
        }
    }

    if (mainStart === -1 || mainEnd === -1) {
        return code;
    }

    let returnLine = -1;
    for (let i = mainStart; i <= mainEnd; i++) {
        if (lines[i].includes('return')) {
            returnLine = i;
            break;
        }
    }

    for (let i = 0; i < lines.length; i++) {
        if (i === returnLine && returnLine !== -1) {
            result.push('    std::cin.get();');
            result.push(lines[i]);
        } else if (i === mainEnd && returnLine === -1) {
            result.push('    std::cin.get();');
            result.push('    return 0;');
            result.push(lines[i]);
        } else {
            result.push(lines[i]);
        }
    }

    return result.join('\n');
}

function saveCodeForBuild() {
    const code = editor.value;
    const buildCode = addPauseForBuild(code);
    ipcRenderer.send('save-code', buildCode);
    return buildCode;
}

function saveCodeNormal() {
    const code = editor.value;
    originalCode = code;
    ipcRenderer.send('save-code', code);
}

function updateLineNumbers() {
    const lines = editor.value.split('\n');
    const count = lines.length;
    let html = '';
    for (let i = 1; i <= count; i++) {
        html += `<span>${i}</span>`;
    }
    lineNumbers.innerHTML = html;
    lineCount.textContent = `${count} lines`;
}

// =============================================
// 라인 번호 스크롤 동기화
// =============================================
editor.addEventListener('scroll', () => {
    lineNumbers.scrollTop = editor.scrollTop;
});

// =============================================
// Output Functions
// =============================================
function addOutput(text, type = 'info') {
    const div = document.createElement('div');
    div.textContent = text;
    const colors = {
        success: '#4ec9b0',
        error: '#f44747',
        warning: '#dcdcaa',
        run: '#569cd6',
        info: '#cccccc'
    };
    div.style.color = colors[type] || colors.info;
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordBreak = 'break-all';
    const placeholder = outputContent.querySelector('.output-placeholder');
    if (placeholder) placeholder.remove();
    outputContent.appendChild(div);
    outputContent.scrollTop = outputContent.scrollHeight;
}

function clearOutput() {
    outputContent.innerHTML = '<span class="output-placeholder">Ready. Press F9 to compile...</span>';
}

function setStatus(text, color = '#4ec9b0') {
    statusText.textContent = text;
    statusText.style.color = color;
    statusTime.textContent = new Date().toLocaleTimeString();
}

// =============================================
// Compile + Run
// =============================================
function compileAndRun() {
    setStatus('Compiling...', '#dcdcaa');
    addOutput('Compiling compiler.cpp...', 'info');
    saveCodeForBuild();
    ipcRenderer.send('compile-run', linkerSettings);
}

// =============================================
// 🔥 New Linker Settings UI (Modal Window)
// =============================================
function openLinkerSettingsWindow() {
    // 현재 설정값 읽기
    const currentLibPaths = linkerSettings.libraryPaths.join('\n');
    const currentLibs = linkerSettings.libraries.join('\n');
    const currentIncludes = linkerSettings.includePaths.join('\n');
    const currentExtras = linkerSettings.extraOptions.join(' ');

    // Modal HTML
    const modalHtml = `
        <div id="linkerModal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); display:flex; justify-content:center; align-items:center; z-index:9999; font-family:inherit;">
            <div style="background:#2d2d2d; border-radius:12px; padding:30px; width:550px; max-height:80vh; overflow-y:auto; color:#d4d4d4; border:1px solid #4ec9b0; box-shadow:0 10px 40px rgba(0,0,0,0.5);">
                <h2 style="color:#4ec9b0; margin-top:0; border-bottom:1px solid #444; padding-bottom:10px;">🔗 Linker Settings</h2>
                
                <div style="margin-bottom:15px;">
                    <label style="display:block; margin-bottom:5px; font-weight:bold; color:#ccc;">Library Paths (-L)</label>
                    <textarea id="linkerLibPaths" rows="3" style="width:100%; background:#1e1e1e; color:#d4d4d4; border:1px solid #444; border-radius:4px; padding:8px; font-family:Consolas, monospace; resize:none;">${currentLibPaths}</textarea>
                    <div style="font-size:11px; color:#888; margin-top:4px;">One path per line (e.g., ./lib)</div>
                </div>

                <div style="margin-bottom:15px;">
                    <label style="display:block; margin-bottom:5px; font-weight:bold; color:#ccc;">Libraries (-l)</label>
                    <textarea id="linkerLibs" rows="3" style="width:100%; background:#1e1e1e; color:#d4d4d4; border:1px solid #444; border-radius:4px; padding:8px; font-family:Consolas, monospace; resize:none;">${currentLibs}</textarea>
                    <div style="font-size:11px; color:#888; margin-top:4px;">One library per line (e.g., winmm)</div>
                </div>

                <div style="margin-bottom:15px;">
                    <label style="display:block; margin-bottom:5px; font-weight:bold; color:#ccc;">Include Paths (-I)</label>
                    <textarea id="linkerIncludes" rows="3" style="width:100%; background:#1e1e1e; color:#d4d4d4; border:1px solid #444; border-radius:4px; padding:8px; font-family:Consolas, monospace; resize:none;">${currentIncludes}</textarea>
                    <div style="font-size:11px; color:#888; margin-top:4px;">One path per line (e.g., ./include)</div>
                </div>

                <div style="margin-bottom:20px;">
                    <label style="display:block; margin-bottom:5px; font-weight:bold; color:#ccc;">Extra Options</label>
                    <input id="linkerExtras" type="text" style="width:100%; background:#1e1e1e; color:#d4d4d4; border:1px solid #444; border-radius:4px; padding:8px; font-family:Consolas, monospace;" value="${currentExtras}">
                    <div style="font-size:11px; color:#888; margin-top:4px;">Separate with space (e.g., -static -Wall)</div>
                </div>

                <div style="display:flex; gap:10px; justify-content:flex-end; border-top:1px solid #444; padding-top:15px;">
                    <button id="linkerCancelBtn" style="background:#444; color:#ccc; border:none; padding:8px 20px; border-radius:6px; cursor:pointer; font-weight:bold;">Cancel</button>
                    <button id="linkerSaveBtn" style="background:#4ec9b0; color:#1e1e1e; border:none; padding:8px 20px; border-radius:6px; cursor:pointer; font-weight:bold;">Add / Apply</button>
                </div>
            </div>
        </div>
    `;

    // Modal 삽입
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);

    // 버튼 이벤트
    document.getElementById('linkerCancelBtn').addEventListener('click', () => {
        modalContainer.remove();
    });

    document.getElementById('linkerSaveBtn').addEventListener('click', () => {
        // 입력값 읽기
        const libPaths = document.getElementById('linkerLibPaths').value.split('\n').map(s => s.trim()).filter(Boolean);
        const libs = document.getElementById('linkerLibs').value.split('\n').map(s => s.trim()).filter(Boolean);
        const includes = document.getElementById('linkerIncludes').value.split('\n').map(s => s.trim()).filter(Boolean);
        const extras = document.getElementById('linkerExtras').value.trim().split(/\s+/).filter(Boolean);

        // 저장
        linkerSettings.libraryPaths = libPaths;
        linkerSettings.libraries = libs;
        linkerSettings.includePaths = includes;
        linkerSettings.extraOptions = extras;
        saveLinkerSettings();

        addOutput('✅ Linker settings applied!', 'success');
        modalContainer.remove();
    });

    // 배경 클릭 시 닫기
    modalContainer.addEventListener('click', (e) => {
        if (e.target === modalContainer) {
            modalContainer.remove();
        }
    });
}

// =============================================
// 🔥 IPC Events (Menu)
// =============================================
// File Menu
ipcRenderer.on('menu-new', () => {
    if (confirm('Clear current code?')) {
        editor.value = '';
        originalCode = '';
        updateLineNumbers();
        addOutput('New file created', 'info');
    }
});

ipcRenderer.on('menu-open', () => {
    const filePath = prompt('Enter C++ file path:');
    if (filePath) {
        try {
            if (fs.existsSync(filePath)) {
                const code = fs.readFileSync(filePath, 'utf8');
                editor.value = code;
                originalCode = code;
                updateLineNumbers();
                addOutput(`Loaded: ${filePath}`, 'success');
            } else {
                addOutput(`File not found: ${filePath}`, 'error');
            }
        } catch (err) {
            addOutput(`Failed to load: ${err.message}`, 'error');
        }
    }
});

ipcRenderer.on('menu-save', () => {
    saveCodeNormal();
    setStatus('Code saved!', '#4ec9b0');
    addOutput('Code saved to compiler.cpp', 'success');
});

// Linker Menu - 모두 동일한 Modal 창으로 연결!
ipcRenderer.on('menu-linker-librarypaths', () => openLinkerSettingsWindow());
ipcRenderer.on('menu-linker-libraries', () => openLinkerSettingsWindow());
ipcRenderer.on('menu-linker-includepaths', () => openLinkerSettingsWindow());
ipcRenderer.on('menu-linker-extra', () => openLinkerSettingsWindow());

ipcRenderer.on('menu-linker-reset', () => {
    if (confirm('Reset all linker settings to default?')) {
        linkerSettings = {
            libraryPaths: [],
            libraries: [],
            includePaths: [],
            extraOptions: []
        };
        saveLinkerSettings();
        addOutput('🔄 Linker settings reset to default', 'info');
    }
});

// Help Menu
ipcRenderer.on('menu-help-docs', () => {
    addOutput('Documentation: https://github.com/yourusername/codecraft-x', 'info');
});

ipcRenderer.on('menu-help-about', () => {
    alert('CodeCraft X v1.0.0\n\nVisual Studio-style C++ IDE\nBuilt with Electron\n\n🚀 Happy Coding!');
});

// =============================================
// IPC Events (Compile)
// =============================================
ipcRenderer.on('save-result', (event, result) => {
    if (result.success) {
        addOutput('Code saved!', 'success');
    } else {
        setStatus('Failed to save', '#f44747');
        addOutput('Failed to save: ' + result.message, 'error');
    }
});

ipcRenderer.on('compile-result', (event, result) => {
    if (result.success) {
        setStatus('Compilation successful', '#4ec9b0');
        addOutput('Compilation successful!', 'success');
        if (result.warning) {
            addOutput('Warning:', 'warning');
            addOutput(result.warning, 'warning');
        }
    } else {
        setStatus('Compilation failed', '#f44747');
        addOutput('Compilation failed!', 'error');
        if (result.error) {
            addOutput('Error details:', 'error');
            addOutput(result.error, 'error');
        }
    }
});

ipcRenderer.on('run-start', (event, data) => {
    addOutput(data.message, 'run');
});

ipcRenderer.on('run-finished', (event, data) => {
    setStatus(data.message, data.code === 0 ? '#4ec9b0' : '#f44747');
    addOutput(data.message, data.code === 0 ? 'success' : 'error');
    if (data.errorDetail) {
        addOutput('Error details:', 'error');
        addOutput(data.errorDetail, 'error');
    }
    setTimeout(() => {
        editor.value = originalCode;
        updateLineNumbers();
        addOutput('Restored original code', 'info');
    }, 500);
});

// =============================================
// Editor Events
// =============================================
editor.addEventListener('input', () => {
    originalCode = editor.value;
    updateLineNumbers();
});

editor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + 4;
        originalCode = editor.value;
        updateLineNumbers();
    }
    if (e.key === 'F9') {
        e.preventDefault();
        compileAndRun();
    }
});

// =============================================
// Button Events
// =============================================
runBtn.addEventListener('click', compileAndRun);
saveBtn.addEventListener('click', () => {
    saveCodeNormal();
    setStatus('Code saved!', '#4ec9b0');
    addOutput('Code saved to compiler.cpp', 'success');
});
clearBtn.addEventListener('click', clearOutput);

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveCodeNormal();
        setStatus('Code saved!', '#4ec9b0');
        addOutput('Code saved to compiler.cpp', 'success');
    }
});

// =============================================
// Start
// =============================================
loadLinkerSettings();
loadCode();
setStatus('Ready', '#4ec9b0');
addOutput('CodeCraft X started!', 'info');
addOutput('Write your code and press F9 to compile & run', 'info');
addOutput('Auto-pause added only during build, removed after!', 'success');
addOutput('Linker settings available in menu bar!', 'info');
