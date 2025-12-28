/**
 * REAL BACKEND FOR WINBORG
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

let mainWindow;
// Keep track of active mount processes to kill them on exit/unmount
const activeMounts = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false, // Frameless for custom Windows 11 UI
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Security: Allow direct access to node in renderer for this local app
    },
    backgroundColor: '#f3f3f3',
    icon: path.join(__dirname, 'public/icon.png')
  });

  // For development (Vite runs on 5173 by default)
  mainWindow.loadURL('http://localhost:5173');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // Clean up mounts before quitting
  activeMounts.forEach((process) => {
    try { process.kill(); } catch(e) {}
  });
  if (process.platform !== 'darwin') app.quit();
});

// --- HELPER ---
function getEnv(customEnv) {
    return { 
        ...process.env, 
        BORG_UNKNOWN_UNENCRYPTED_REPO_ACCESS_IS_OK: 'yes',
        BORG_RELOCATED_REPO_ACCESS_IS_OK: 'yes',
        ...customEnv 
    };
}

// --- REAL BACKEND API HANDLERS ---

/**
 * Executes a Borg command
 */
ipcMain.handle('borg-spawn', (event, { args, commandId, executablePath, envVars }) => {
  return new Promise((resolve) => {
    const bin = executablePath || 'borg';
    
    // Verify existence if it looks like a full path
    if (bin.includes('\\') || bin.includes('/')) {
        if (!fs.existsSync(bin)) {
            const errorMsg = `Error: Executable not found at ${bin}`;
            if (mainWindow) mainWindow.webContents.send('terminal-log', { id: commandId, text: errorMsg });
            return resolve({ success: false, error: errorMsg });
        }
    }

    console.log(`[Borg] Executing: ${bin} ${args.join(' ')}`);
    
    try {
        const child = spawn(bin, args, {
          env: getEnv(envVars),
          shell: true 
        });

        child.stdout.on('data', (data) => {
          if (mainWindow) mainWindow.webContents.send('terminal-log', { id: commandId, text: data.toString() });
        });

        child.stderr.on('data', (data) => {
          if (mainWindow) mainWindow.webContents.send('terminal-log', { id: commandId, text: data.toString() });
        });

        child.on('close', (code) => {
          console.log(`[Borg] Process exited with code ${code}`);
          resolve({ success: code === 0, code });
        });

        child.on('error', (err) => {
          console.error(`[Borg] Failed to start process: ${err.message}`);
          if (mainWindow) mainWindow.webContents.send('terminal-log', { id: commandId, text: `Error: ${err.message}` });
          resolve({ success: false, error: err.message });
        });
    } catch (e) {
        if (mainWindow) mainWindow.webContents.send('terminal-log', { id: commandId, text: `Critical Error: ${e.message}` });
        resolve({ success: false, error: e.message });
    }
  });
});

/**
 * Handle persistent mount processes
 */
ipcMain.handle('borg-mount', (event, { args, mountId, executablePath, envVars }) => {
  return new Promise((resolve) => {
    const bin = executablePath || 'borg';
    console.log(`[Borg Mount] Starting mount: ${bin} ${args.join(' ')}`);
    
    try {
        const child = spawn(bin, args, {
            env: getEnv(envVars),
            shell: true
        });

        activeMounts.set(mountId, child);

        child.stdout.on('data', (data) => {
          if (mainWindow) mainWindow.webContents.send('terminal-log', { id: 'mount', text: data.toString() });
        });

        child.stderr.on('data', (data) => {
          if (mainWindow) mainWindow.webContents.send('terminal-log', { id: 'mount', text: data.toString() });
        });

        child.on('close', (code) => {
          console.log(`[Borg Mount] Mount process exited code ${code}`);
          activeMounts.delete(mountId);
          if (mainWindow) mainWindow.webContents.send('mount-exited', { mountId, code });
        });

        // Give it a second to fail, otherwise assume success (Mounting blocks)
        setTimeout(() => {
            if (activeMounts.has(mountId)) {
                resolve({ success: true, pid: child.pid });
            } else {
                resolve({ success: false });
            }
        }, 2000);
    } catch (e) {
        resolve({ success: false, error: e.message });
    }
  });
});

ipcMain.handle('borg-unmount', (event, { mountId, localPath, executablePath }) => {
  return new Promise((resolve) => {
    // 1. Try to kill the process if we tracked it
    if (activeMounts.has(mountId)) {
        const child = activeMounts.get(mountId);
        child.kill();
        activeMounts.delete(mountId);
    }

    const bin = executablePath || 'borg';
    // 2. Also run 'borg umount' command just in case
    exec(`"${bin}" umount ${localPath}`, (err) => {
        resolve({ success: true });
    });
  });
});