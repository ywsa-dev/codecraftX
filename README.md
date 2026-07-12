# 🚀 CodeCraft X

**CodeCraft X** is a lightweight, Visual Studio-style C++ IDE built with Electron.  
It provides a clean and efficient environment for writing, compiling, and running your C++ programs. With a quick initial setup, you can compile and run C++ code instantly!

(run: compiler.bat)
 
---

## ✨ Features

### ⚡ One-click Compilation
- Press `F9` or click the **Run** button to compile instantly
- No complex build configurations needed
- Perfect for quick testing and prototyping

### 🚀 Instant Execution
- Your program runs in a separate console window
- See output immediately after compilation
- No need to manually open a terminal

### 🔧 Easy Compiler Setup
- **No manual MinGW or GCC installation required!**
- Simply run the initialization script (`mingw64init.bat`) to automatically download and set up the g++ compiler.
- Once initialized, it works right out of the box on Windows.

### 📋 Detailed Error Output
- Clear compilation error messages
- Runtime error details displayed
- Easy to debug and fix your code

### 💾 Auto-save
- Code is automatically saved before compilation
- Never lose your work
- Manual save also available with `Ctrl+S`

### 🔄 Auto-pause
- Program automatically waits for a key press after execution
- See your program output clearly
- No need to add `system("pause")` manually

### 🎯 Cross-platform
- Works on Windows (primary support)
- macOS and Linux support coming soon

---

## 📦 Requirements & Setup

To run CodeCraft X, you need to set up the Node.js environment and initialize the C++ compiler.

### 1. Node.js & npm (Required)

Node.js is a JavaScript runtime that allows CodeCraft X to run as a desktop application. npm (Node Package Manager) is used to install the necessary libraries and dependencies.

#### How to Install Node.js
1. Download Node.js from: [https://nodejs.org/](https://nodejs.org/)
2. Choose the **LTS version** (Long-Term Support) for the best stability.
3. Run the installer and follow the installation steps.
4. Verify the installation by running these commands in your terminal:
   ```bash
   node --version
   npm --version
