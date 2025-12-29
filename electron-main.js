

/**
 * REAL BACKEND FOR WINBORG
 */

const { app, BrowserWindow, ipcMain, shell, Tray, Menu, safeStorage, nativeImage } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;
let tray = null;
let isQuitting = false;

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

function createWindow() {
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
    icon: path.join(__dirname, 'public/icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: false
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Handle Close (Minimize to Tray instead of Quit)
  mainWindow.on('close', (event) => {
      if (!isQuitting) {
          event.preventDefault();
          mainWindow.hide();
          return false;
      }
  });
}

function createTray() {
    const iconPath = path.join(__dirname, 'public/icon.png');
    const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16 });
    
    tray = new Tray(trayIcon);
    tray.setToolTip('WinBorg Manager');
    
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Open WinBorg', click: () => mainWindow.show() },
        { type: 'separator' },
        { label: 'Quit', click: () => {
            isQuitting = true;
            app.quit();
        }}
    ]);
    
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => mainWindow.show());
}

app.whenReady().then(() => {
    createWindow();
    createTray();
});

app.on('before-quit', () => {
    isQuitting = true;
});

app.on('window-all-closed', () => {
  // Do NOT quit automatically on Windows close, wait for Tray Quit
  if (process.platform !== 'darwin' && isQuitting) {
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

// --- WINDOW CONTROLS HANDLERS ---
ipcMain.on('window-minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
    }
});
ipcMain.on('window-close', () => {
    // This triggers the 'close' event on BrowserWindow, which we intercept above
    if (mainWindow) mainWindow.close(); 
});

// --- TASKBAR PROGRESS ---
ipcMain.on('set-progress', (event, progress) => {
    // progress should be 0 to 1, or -1 to remove
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
        // If CWD is provided (for extraction), we need to handle it.
        // WSL spawn doesn't accept a Windows CWD directly if we want to run the command inside that folder in Linux context.
        // Strategy: Use "cd /path && borg ..." wrapped in shell
        if (cwd) {
            // Convert C:\Path to /mnt/c/Path for WSL
            let wslCwd = cwd;
            if (/^[a-zA-Z]:/.test(cwd)) {
                const drive = cwd.charAt(0).toLowerCase();
                const pathPart = cwd.slice(2).replace(/\\/g, '/');
                wslCwd = `/mnt/${drive}${pathPart}`;
            }
            
            // For extraction, we must wrap in shell to handle 'cd'
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

    // console.log(`[Borg] Executing: ${bin} ${finalArgs.join(' ')}`); // Disabled for privacy in prod logs
    
    try {
        const child = spawn(bin, finalArgs, {
          env: getEnv(vars),
          shell: !useWsl,
          // Only apply native CWD if NOT using WSL (WSL handled via shell wrap above)
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
    
    // INJECT SECRET
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
