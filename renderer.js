const { ipcRenderer } = require('electron');
const fs = require('fs');

const editor = document.getElementById('codeEditor');
const lineNumbers = document.getElementById('lineNumbers');
const outputContent = document.getElementById('outputContent');
const statusText = document.getElementById('statusText');
const statusTime = document.getElementById('statusTime');
const lineCount = document.getElementById('lineCount');
const runBtn = document.getElementById('runBtn');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');

const defaultCode = `#include <iostream>
#include <string>

int main() {
    std::cout << "Hello world!" << std::endl;
    return 0;
}`;

let originalCode = '';

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
        if (line.includes('Press any key') || 
            line.includes('std::cin.get()')) {
            continue;
        }
        result.push(lines[i]);
    }
    return result.join('\n');
}

// 🔥🔥🔥 수정된 부분: 메시지 없이 std::cin.get()만 추가
function addPauseForBuild(code) {
    if (code.includes('Press any key') || 
        code.includes('system("pause")') || 
        code.includes('std::cin.get()')) {
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

    // 🔥 std::cin.get()만 추가 (메시지 없음)
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

function compileAndRun() {
    setStatus('Compiling...', '#dcdcaa');
    addOutput('Compiling compiler.cpp...', 'info');
    saveCodeForBuild();
    ipcRenderer.send('compile-run');
}

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

loadCode();
setStatus('Ready', '#4ec9b0');
addOutput('Cpp Compiler started!', 'info');
addOutput('Write your code and press F9 to compile & run', 'info');
addOutput('Auto-pause added only during build, removed after!', 'success');