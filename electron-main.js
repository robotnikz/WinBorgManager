

/**
 * REAL BACKEND FOR WINBORG
 */

const { app, BrowserWindow, ipcMain, shell, Tray, Menu, safeStorage, nativeImage, dialog } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// --- CONFIGURATION ---
// CHANGE THIS TO YOUR REPO: user/repo
const GITHUB_REPO = "robotnikz/WinBorg"; 

let mainWindow;
let tray = null;
let isQuitting = false;
let closeToTray = false; // Default: Close quits app

// Keep track of active mount processes to kill them on exit/unmount
const activeMounts = new Map();
// Keep track of general active processes
const activeProcesses = new Map();

// SECRETS MANAGEMENT
const secretsPath = path.join(app.getPath('userData'), 'secrets.json');
let secretsCache = {};

// Load secrets on startup
try {
    if (fs.existsSync(secretsPath)) {
        secretsCache = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
    }
} catch (e) {
    console.error("Failed to load secrets", e);
}

// Helper: Save secrets to disk
function persistSecrets() {
    try {
        fs.writeFileSync(secretsPath, JSON.stringify(secretsCache));
    } catch (e) {
        console.error("Failed to save secrets", e);
    }
}

// Helper: Get decrypted password for a repo
function getDecryptedPassword(repoId) {
    if (!repoId || !secretsCache[repoId]) return null;
    try {
        if (safeStorage.isEncryptionAvailable()) {
            const buffer = Buffer.from(secretsCache[repoId], 'hex');
            return safeStorage.decryptString(buffer);
        }
    } catch (e) {
        console.error("Failed to decrypt password for " + repoId, e);
    }
    return null;
}

const isDev = !app.isPackaged;

function getIconPath() {
    // In dev, use public folder. In prod, use dist folder (copied by Vite)
    const p = isDev ? path.join(__dirname, 'public/icon.png') : path.join(__dirname, 'dist/icon.png');
    return fs.existsSync(p) ? p : null;
}

function createWindow() {
  const iconPath = getIconPath();
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false, 
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, 
      webSecurity: false 
    },
    backgroundColor: '#f3f3f3',
    icon: iconPath, // Sets the Window Icon (Top left & Taskbar)
    titleBarStyle: 'hidden',
    titleBarOverlay: false
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Handle Close behavior based on settings
  mainWindow.on('close', (event) => {
      if (!isQuitting) {
          if (closeToTray) {
              event.preventDefault();
              mainWindow.hide();
              return false;
          }
      }
  });
}

function createTray() {
    const iconPath = getIconPath();
    if (!iconPath) {
        console.warn("No icon path found");
        return; 
    }
    
    try {
        // Create native image safely
        const image = nativeImage.createFromPath(iconPath);
        
        // CRITICAL: Check if image is valid/empty. 
        // If public/icon.png is corrupt, this prevents the app from crashing.
        if (image.isEmpty()) {
            console.warn("Tray icon file exists but is invalid/empty:", iconPath);
            return;
        }

        const trayIcon = image.resize({ width: 16, height: 16 });
        
        tray = new Tray(trayIcon);
        tray.setToolTip('WinBorg Manager');
        
        const contextMenu = Menu.buildFromTemplate([
            { label: 'Open WinBorg', click: () => mainWindow.show() },
            { type: 'separator' },
            { label: 'Check for Updates', click: () => checkForUpdates(true) },
            { type: 'separator' },
            { label: 'Quit', click: () => {
                isQuitting = true;
                app.quit();
            }}
        ]);
        
        tray.setContextMenu(contextMenu);
        
        // Restore on double click
        tray.on('double-click', () => {
            if (mainWindow) {
                mainWindow.show();
                mainWindow.focus();
            }
        });
    } catch (e) {
        console.warn("Failed to create tray icon:", e);
    }
}

// --- UPDATE CHECKER LOGIC ---
async function checkForUpdates(manual = false) {
    try {
        const pkg = require('./package.json');
        const currentVersion = pkg.version;
        
        const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
            headers: { 'User-Agent': 'WinBorg-Updater' }
        });
        
        if (response.status === 404) {
            if (manual) {
                dialog.showMessageBoxSync(mainWindow, {
                    type: 'info',
                    title: 'No Releases Found',
                    message: 'No published releases found on GitHub.',
                    detail: `The repository ${GITHUB_REPO} does not have any releases tagged 'latest'.`
                });
            }
            return;
        }

        if (!response.ok) throw new Error(`GitHub API Error: ${response.status} ${response.statusText}`);
        
        const data = await response.json();
        const latestVersion = data.tag_name.replace(/^v/, ''); 
        
        if (latestVersion !== currentVersion) {
            const choice = dialog.showMessageBoxSync(mainWindow, {
                type: 'info',
                buttons: ['Download', 'Later'],
                title: 'Update Available',
                message: `A new version (${latestVersion}) is available.`,
                detail: `Current version: ${currentVersion}\n\n${data.body || 'New features and bug fixes.'}`
            });
            
            if (choice === 0) {
                shell.openExternal(data.html_url);
            }
        } else if (manual) {
            dialog.showMessageBoxSync(mainWindow, {
                type: 'info',
                title: 'No Updates',
                message: 'You are using the latest version.',
                detail: `Version: ${currentVersion}`
            });
        }
    } catch (e) {
        if (manual) {
            dialog.showMessageBoxSync(mainWindow, {
                type: 'error',
                title: 'Update Check Failed',
                message: 'Could not check for updates.',
                detail: e.message
            });
        }
        console.error("Update check failed:", e);
    }
}

app.whenReady().then(() => {
    createWindow();
    createTray();
    
    setTimeout(() => checkForUpdates(false), 3000);
});

app.on('before-quit', () => {
    isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !closeToTray) {
      cleanupAndQuit();
  }
});

function cleanupAndQuit() {
    activeMounts.forEach((process) => {
        try { process.kill(); } catch(e) {}
    });
    activeProcesses.forEach((process) => {
        try { process.kill(); } catch(e) {}
    });
    app.quit();
}

// --- IPC HANDLERS ---

ipcMain.on('set-close-behavior', (event, shouldCloseToTray) => {
    closeToTray = shouldCloseToTray;
});

ipcMain.handle('check-for-updates', async () => {
    await checkForUpdates(true);
    return true;
});

ipcMain.on('window-minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
    }
});
ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close(); 
});

ipcMain.on('set-progress', (event, progress) => {
    if (mainWindow) {
        mainWindow.setProgressBar(progress);
    }
});

ipcMain.on('open-path', (event, pathString) => {
    console.log("Opening Path:", pathString);
    if (pathString.startsWith('/') || pathString.startsWith('\\\\wsl')) {
        let linuxPath = pathString;
        if (pathString.startsWith('\\\\')) {
             shell.openPath(pathString).catch(err => console.error(err));
             return; 
        }
        const cmd = `wsl --exec explorer.exe "${linuxPath}"`;
        exec(cmd, (err) => { if (err) console.error(err); });
    } else {
        shell.openPath(pathString).catch(error => console.error(error));
    }
});

// --- SECRETS API ---
ipcMain.handle('save-secret', async (event, { repoId, passphrase }) => {
    if (!safeStorage.isEncryptionAvailable()) return { success: false, error: "Encryption not available" };
    try {
        const buffer = safeStorage.encryptString(passphrase);
        secretsCache[repoId] = buffer.toString('hex');
        persistSecrets();
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('delete-secret', async (event, { repoId }) => {
    if (secretsCache[repoId]) {
        delete secretsCache[repoId];
        persistSecrets();
    }
    return { success: true };
});

ipcMain.handle('has-secret', async (event, { repoId }) => {
    return { hasSecret: !!secretsCache[repoId] };
});

// --- HELPER ---
function getEnv(customEnv) {
    return { ...process.env, ...customEnv };
}

// --- SYSTEM PATHS ---
ipcMain.handle('get-downloads-path', () => {
    return app.getPath('downloads');
});

ipcMain.handle('create-directory', (event, pathString) => {
    return new Promise((resolve) => {
        try {
            fs.mkdirSync(pathString, { recursive: true });
            resolve(true);
        } catch (e) {
            console.error("Failed to create directory", e);
            resolve(false);
        }
    });
});

ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    return result;
});

// --- BORG EXECUTION ---

ipcMain.handle('borg-spawn', (event, { args, commandId, useWsl, executablePath, envVars, forceBinary, wslUser, repoId, cwd }) => {
  return new Promise((resolve) => {
    let bin, finalArgs;
    const targetBinary = forceBinary || 'borg';
    
    // INJECT SECRET IF REPO ID PROVIDED
    const vars = { ...envVars };
    if (repoId) {
        const secret = getDecryptedPassword(repoId);
        if (secret) {
            vars.BORG_PASSPHRASE = secret;
            console.log(`[Security] Injected secure passphrase for Repo ${repoId}`);
        }
    }

    if (useWsl) {
        bin = 'wsl'; 
        if (cwd) {
            let wslCwd = cwd;
            if (/^[a-zA-Z]:/.test(cwd)) {
                const drive = cwd.charAt(0).toLowerCase();
                const pathPart = cwd.slice(2).replace(/\\/g, '/');
                wslCwd = `/mnt/${drive}${pathPart}`;
            }
            const cmdString = `cd "${wslCwd}" && ${targetBinary} ${args.map(a => `"${a}"`).join(' ')}`;
            finalArgs = wslUser ? ['-u', wslUser, '--exec', 'sh', '-c', cmdString] : ['--exec', 'sh', '-c', cmdString];
        } else {
            if (wslUser) {
                finalArgs = ['-u', wslUser, '--exec', targetBinary, ...args];
            } else {
                finalArgs = ['--exec', targetBinary, ...args];
            }
        }
    } else {
        bin = (targetBinary === 'borg') ? (executablePath || 'borg') : targetBinary;
        finalArgs = args;
    }
    
    try {
        const child = spawn(bin, finalArgs, {
          env: getEnv(vars),
          shell: !useWsl,
          cwd: (!useWsl && cwd) ? cwd : undefined
        });

        activeProcesses.set(commandId, child);

        child.stdout.on('data', (data) => {
          if (mainWindow) mainWindow.webContents.send('terminal-log', { id: commandId, text: data.toString() });
        });

        child.stderr.on('data', (data) => {
          const text = data.toString();
          if (mainWindow) mainWindow.webContents.send('terminal-log', { id: commandId, text: text });
        });

        child.on('close', (code) => {
          activeProcesses.delete(commandId);
          resolve({ success: code === 0, code });
        });

        child.on('error', (err) => {
          activeProcesses.delete(commandId);
          if (mainWindow) mainWindow.webContents.send('terminal-log', { id: commandId, text: `Error: ${err.message}` });
          resolve({ success: false, error: err.message });
        });
    } catch (e) {
        activeProcesses.delete(commandId);
        resolve({ success: false, error: e.message });
    }
  });
});

ipcMain.handle('borg-stop', (event, { commandId }) => {
    return new Promise((resolve) => {
        const child = activeProcesses.get(commandId);
        if (child) {
            child.kill(); 
            resolve({ success: true });
        } else {
            resolve({ success: false, error: "Process not found" });
        }
    });
});

ipcMain.handle('borg-mount', (event, { args, mountId, useWsl, executablePath, envVars, repoId }) => {
  return new Promise((resolve) => {
    let bin, finalArgs;
    
    const vars = { ...envVars };
    if (repoId) {
        const secret = getDecryptedPassword(repoId);
        if (secret) vars.BORG_PASSPHRASE = secret;
    }

    if (useWsl) {
        const mountPoint = args[args.length - 1]; 
        try {
            require('child_process').execSync(`wsl --exec sh -c "mkdir -p '${mountPoint}' && chmod 777 '${mountPoint}'"`);
        } catch(e) { 
            return resolve({ success: false, error: "MKDIR_FAILED" });
        }
        bin = 'wsl';
        finalArgs = ['--exec', 'borg', ...args];
    } else {
        bin = executablePath || 'borg';
        finalArgs = args;
    }
    
    try {
        const child = spawn(bin, finalArgs, {
            env: getEnv(vars),
            shell: !useWsl
        });

        activeMounts.set(mountId, child);

        child.stderr.on('data', (data) => {
          const text = data.toString();
          if (mainWindow) mainWindow.webContents.send('terminal-log', { id: 'mount', text: text });
        });

        child.on('close', (code) => {
          activeMounts.delete(mountId);
          if (mainWindow) mainWindow.webContents.send('mount-exited', { mountId, code });
        });

        setTimeout(() => {
            if (activeMounts.has(mountId)) {
                resolve({ success: true, pid: child.pid });
            } else {
                resolve({ success: false, error: 'PROCESS_EXITED' });
            }
        }, 2500);
    } catch (e) {
        resolve({ success: false, error: e.message });
    }
  });
});

ipcMain.handle('borg-unmount', (event, { mountId, localPath, useWsl, executablePath }) => {
  return new Promise((resolve) => {
    if (activeMounts.has(mountId)) {
        activeMounts.get(mountId).kill(); 
        activeMounts.delete(mountId);
    }
    const cmd = useWsl ? `wsl --exec fusermount3 -u -z ${localPath}` : `"${executablePath||'borg'}" umount ${localPath}`;
    exec(cmd, () => resolve({ success: true }));
  });
});