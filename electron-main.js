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
    minWidth: 800,
    minHeight: 600,
    frame: false, // Frameless for custom Windows 11 UI
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Security: Allow direct access to node in renderer for this local app
    },
    backgroundColor: '#f3f3f3',
    icon: path.join(__dirname, 'public/icon.png'),
    // Windows 11 styling hint
    titleBarStyle: 'hidden',
    titleBarOverlay: false
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

// --- HELPER ---
function getEnv(customEnv) {
    return { 
        ...process.env, 
        ...customEnv 
    };
}

// --- REAL BACKEND API HANDLERS ---

/**
 * Executes a Borg command
 */
ipcMain.handle('borg-spawn', (event, { args, commandId, useWsl, executablePath, envVars }) => {
  return new Promise((resolve) => {
    let bin, finalArgs;

    if (useWsl) {
        bin = 'wsl'; // Use system wsl.exe
        // Use 'exec' inside WSL so env vars are picked up cleanly and we run the command
        // args is an array like ['list', 'ssh://...']. 
        // We convert to: wsl --exec borg list ssh://...
        finalArgs = ['--exec', 'borg', ...args];
    } else {
        bin = executablePath || 'borg';
        finalArgs = args;
        
        // Verify existence if it looks like a full path and we aren't using WSL
        if ((bin.includes('\\') || bin.includes('/')) && !fs.existsSync(bin)) {
            const errorMsg = `Error: Executable not found at ${bin}`;
            if (mainWindow) mainWindow.webContents.send('terminal-log', { id: commandId, text: errorMsg });
            return resolve({ success: false, error: errorMsg });
        }
    }

    console.log(`[Borg] Executing: ${bin} ${finalArgs.join(' ')}`);
    // Log env vars helpful for debugging (masking password)
    if (envVars.BORG_PASSPHRASE) console.log(`[Borg] using passphrase: ****`);
    if (envVars.BORG_RSH) console.log(`[Borg] using BORG_RSH: ${envVars.BORG_RSH}`);
    
    try {
        const child = spawn(bin, finalArgs, {
          env: getEnv(envVars),
          shell: !useWsl // Use shell true for windows native to handle path parsing better, false for WSL usually ok
        });

        child.stdout.on('data', (data) => {
          const text = data.toString();
          console.log(`[Borg STDOUT] ${text.trim()}`); // Log to terminal for debugging
          if (mainWindow) mainWindow.webContents.send('terminal-log', { id: commandId, text: text });
        });

        child.stderr.on('data', (data) => {
          const text = data.toString();
          console.error(`[Borg STDERR] ${text.trim()}`); // Log to terminal for debugging
          if (mainWindow) mainWindow.webContents.send('terminal-log', { id: commandId, text: text });

          // WINBORG UX IMPROVEMENT: Detect common "command not found" errors
          const lower = text.toLowerCase();
          if (
              lower.includes('not recognized') || 
              lower.includes('falsch geschrieben') || 
              lower.includes('not found') ||
              lower.includes('nicht gefunden')
          ) {
              const hint = `\n[WinBorg Hint] 🔴 Borg binary not found!\n` +
                           `1. If you want to use Windows native: Install Borg (e.g. 'scoop install borgbackup').\n` +
                           `2. If you want to use WSL (Linux): Go to Settings and enable 'Use WSL'.\n` + 
                           `3. Check the Path in Settings.`;
              if (mainWindow) mainWindow.webContents.send('terminal-log', { id: commandId, text: hint });
          }
          
          // Detect SSH Permission Denied (e.g. missing keys)
          if (lower.includes('permission denied') && (lower.includes('publickey') || lower.includes('password'))) {
             const hint = `\n[WinBorg Hint] 🔐 SSH Access Denied!\n` +
                          `The server rejected the key. Borg cannot ask for passwords here.\n` +
                          `FIX: Copy your SSH key to the server. Run this in your WSL terminal:\n` +
                          `ssh-copy-id -p <PORT> <USER>@<HOST>`;
             if (mainWindow) mainWindow.webContents.send('terminal-log', { id: commandId, text: hint });
          }
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
        console.error(`[Borg] Critical Error: ${e.message}`);
        if (mainWindow) mainWindow.webContents.send('terminal-log', { id: commandId, text: `Critical Error: ${e.message}` });
        resolve({ success: false, error: e.message });
    }
  });
});

/**
 * Handle persistent mount processes
 */
ipcMain.handle('borg-mount', (event, { args, mountId, useWsl, executablePath, envVars }) => {
  return new Promise((resolve) => {
    let bin, finalArgs;
    
    if (useWsl) {
        const mountPoint = args[args.length - 1]; 
        try {
            require('child_process').execSync(`wsl mkdir -p ${mountPoint}`);
        } catch(e) { /* ignore */ }

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
          console.error(`[Mount Error] ${data.toString()}`);
          if (mainWindow) mainWindow.webContents.send('terminal-log', { id: 'mount', text: data.toString() });
        });

        child.on('close', (code) => {
          console.log(`[Borg Mount] Mount process exited code ${code}`);
          activeMounts.delete(mountId);
          if (mainWindow) mainWindow.webContents.send('mount-exited', { mountId, code });
        });

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

ipcMain.handle('borg-unmount', (event, { mountId, localPath, useWsl, executablePath }) => {
  return new Promise((resolve) => {
    if (activeMounts.has(mountId)) {
        const child = activeMounts.get(mountId);
        child.kill(); 
        activeMounts.delete(mountId);
    }

    let cmd;
    if (useWsl) {
        cmd = `wsl --exec borg umount ${localPath}`;
    } else {
        const bin = executablePath || 'borg';
        cmd = `"${bin}" umount ${localPath}`;
    }

    exec(cmd, (err) => {
        resolve({ success: true });
    });
  });
});