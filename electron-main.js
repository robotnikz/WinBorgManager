
/**
 * REAL BACKEND FOR WINBORG
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

let mainWindow;
// Keep track of active mount processes to kill them on exit/unmount
const activeMounts = new Map();
// NEW: Keep track of general active commands (like check, list) to allow aborting
const activeProcesses = new Map();

// Helper to determine if we are in development mode
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false, // Frameless for custom Windows 11 UI
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Security: Allow direct access to node in renderer for this local app
      webSecurity: false // Sometimes needed for local file loading in dev, can be stricter in prod
    },
    backgroundColor: '#f3f3f3',
    icon: path.join(__dirname, 'public/icon.png'),
    // Windows 11 styling hint
    titleBarStyle: 'hidden',
    titleBarOverlay: false
  });

  if (isDev) {
    // Development: Load from Vite Dev Server
    console.log('Running in Development Mode');
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // Production: Load from built files
    console.log('Running in Production Mode');
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // Clean up mounts before quitting
  activeMounts.forEach((process) => {
    try { process.kill(); } catch(e) {}
  });
  activeProcesses.forEach((process) => {
    try { process.kill(); } catch(e) {}
  });
  if (process.platform !== 'darwin') app.quit();
});

// --- WINDOW CONTROLS HANDLERS ---
ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
});

ipcMain.on('open-path', (event, pathString) => {
    console.log("Opening Path:", pathString);
    
    // LINUX PATH HANDLING (WSL)
    if (pathString.startsWith('/') || pathString.startsWith('\\\\wsl')) {
        // If it looks like a Linux path OR a UNC path to WSL
        
        // METHOD 1: Use `wsl --exec explorer.exe <path>`
        // This is robust because we execute explorer from WITHIN linux context, so it handles the path translation.
        // If path is \\wsl$\..., we might need to be careful, but /mnt/wsl/... definitely works here.
        
        let linuxPath = pathString;
        
        // If it was converted to UNC by frontend, convert back to linux for wsl --exec
        // e.g. \\wsl$\Ubuntu\mnt\wsl\winborg -> /mnt/wsl/winborg
        if (pathString.startsWith('\\\\')) {
             // Simplistic attempt: Just try to open it natively in Windows first
             shell.openPath(pathString).then((err) => {
                 if (err) {
                     // If native open fails, log it
                     console.error("Native open failed:", err);
                 }
             });
             return; 
        }

        const cmd = `wsl --exec explorer.exe "${linuxPath}"`;
        console.log("Executing WSL open:", cmd);
        exec(cmd, (err) => {
             if (err) console.error("Failed to open via WSL:", err);
        });
    } else {
        // Normal Windows Path
        shell.openPath(pathString).then((error) => {
            if (error) console.error('Failed to open path:', error);
        });
    }
});

// --- HELPER ---
function getEnv(customEnv) {
    return { 
        ...process.env, 
        ...customEnv 
    };
}

// --- REAL BACKEND API HANDLERS ---

ipcMain.handle('borg-spawn', (event, { args, commandId, useWsl, executablePath, envVars, forceBinary, wslUser }) => {
  return new Promise((resolve) => {
    let bin, finalArgs;
    const targetBinary = forceBinary || 'borg';

    if (useWsl) {
        bin = 'wsl'; 
        // Support running as specific user (e.g. root) for setup tasks
        if (wslUser) {
            finalArgs = ['-u', wslUser, '--exec', targetBinary, ...args];
        } else {
            finalArgs = ['--exec', targetBinary, ...args];
        }
    } else {
        bin = (targetBinary === 'borg') ? (executablePath || 'borg') : targetBinary;
        finalArgs = args;
        
        if ((bin.includes('\\') || bin.includes('/')) && !fs.existsSync(bin)) {
            const errorMsg = `Error: Executable not found at ${bin}`;
            if (mainWindow) mainWindow.webContents.send('terminal-log', { id: commandId, text: errorMsg });
            return resolve({ success: false, error: errorMsg });
        }
    }

    console.log(`[Borg] Executing: ${bin} ${finalArgs.join(' ')}`);
    
    try {
        const child = spawn(bin, finalArgs, {
          env: getEnv(envVars),
          shell: !useWsl 
        });

        activeProcesses.set(commandId, child);

        child.stdout.on('data', (data) => {
          const text = data.toString();
          console.log(`[Borg STDOUT] ${text.trim()}`);
          if (mainWindow) mainWindow.webContents.send('terminal-log', { id: commandId, text: text });
        });

        child.stderr.on('data', (data) => {
          const text = data.toString();
          console.error(`[Borg STDERR] ${text.trim()}`);
          if (mainWindow) mainWindow.webContents.send('terminal-log', { id: commandId, text: text });

          const lower = text.toLowerCase();
          if (lower.includes('not recognized') || lower.includes('falsch geschrieben') || lower.includes('not found')) {
              const hint = `\n[WinBorg Hint] 🔴 Binary '${targetBinary}' not found!`;
              if (mainWindow) mainWindow.webContents.send('terminal-log', { id: commandId, text: hint });
          }
        });

        child.on('close', (code) => {
          console.log(`[Borg] Process exited with code ${code}`);
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
        if (mainWindow) mainWindow.webContents.send('terminal-log', { id: commandId, text: `Critical Error: ${e.message}` });
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

ipcMain.handle('borg-mount', (event, { args, mountId, useWsl, executablePath, envVars }) => {
  return new Promise((resolve) => {
    let bin, finalArgs;
    let fuseError = false;
    
    if (useWsl) {
        const mountPoint = args[args.length - 1]; 
        try {
            console.log(`[Borg Mount] Creating directory and fixing permissions: ${mountPoint}`);
            // Fix permissions: chmod 777 ensures the folder is accessible by "other" (Windows) before mounting
            require('child_process').execSync(`wsl --exec sh -c "mkdir -p '${mountPoint}' && chmod 777 '${mountPoint}'"`);
        } catch(e) { 
            console.error(`[Borg Mount] Failed to create directory ${mountPoint}`, e.message);
            if (mainWindow) mainWindow.webContents.send('terminal-log', { id: 'mount', text: `FATAL ERROR: Failed to create/chmod mountpoint ${mountPoint}.` });
            return resolve({ success: false, error: "MKDIR_FAILED" });
        }

        bin = 'wsl';
        finalArgs = ['--exec', 'borg', ...args];
    } else {
        bin = executablePath || 'borg';
        finalArgs = args;
    }

    console.log(`[Borg Mount] Starting mount: ${bin} ${finalArgs.join(' ')}`);
    
    try {
        const child = spawn(bin, finalArgs, {
            env: getEnv(envVars),
            shell: !useWsl
        });

        activeMounts.set(mountId, child);

        child.stdout.on('data', (data) => {
          if (mainWindow) mainWindow.webContents.send('terminal-log', { id: 'mount', text: data.toString() });
        });

        child.stderr.on('data', (data) => {
          const text = data.toString();
          console.error(`[Mount Error] ${text}`);
          if (mainWindow) mainWindow.webContents.send('terminal-log', { id: 'mount', text: text });
          
          if (text.includes('no FUSE support') || text.includes('fusermount3')) {
              fuseError = true;
              const hint = `\n[WinBorg Hint] 🔴 FUSE Missing or Incomplete!`;
              if (mainWindow) mainWindow.webContents.send('terminal-log', { id: 'mount', text: hint });
          }

          if (text.includes('user_allow_other')) {
              fuseError = true;
              const hint = `\n[WinBorg Hint] 🔴 'user_allow_other' missing. Attempting auto-fix failed.`;
              if (mainWindow) mainWindow.webContents.send('terminal-log', { id: 'mount', text: hint });
          }
          
          if (text.includes('Mountpoint must be a writable directory')) {
               const hint = `\n[WinBorg Hint] 🚫 Permission Error - Use a linux path like /mnt/wsl/...`;
               if (mainWindow) mainWindow.webContents.send('terminal-log', { id: 'mount', text: hint });
          }
        });

        child.on('close', (code) => {
          activeMounts.delete(mountId);
          if (mainWindow) mainWindow.webContents.send('mount-exited', { mountId, code });
        });

        setTimeout(() => {
            if (activeMounts.has(mountId)) {
                resolve({ success: true, pid: child.pid });
            } else {
                resolve({ 
                    success: false, 
                    error: fuseError ? 'FUSE_MISSING' : 'PROCESS_EXITED' 
                });
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
        const child = activeMounts.get(mountId);
        child.kill(); 
        activeMounts.delete(mountId);
    }

    let cmd;
    if (useWsl) {
        cmd = `wsl --exec fusermount3 -u -z ${localPath}`;
    } else {
        const bin = executablePath || 'borg';
        cmd = `"${bin}" umount ${localPath}`;
    }

    exec(cmd, (err) => {
        resolve({ success: true });
    });
  });
});
