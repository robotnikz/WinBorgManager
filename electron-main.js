
/**
 * REAL BACKEND FOR WINBORG
 */

const { app, BrowserWindow, ipcMain, shell, Tray, Menu, safeStorage, nativeImage, dialog, Notification, powerSaveBlocker } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// --- CONFIGURATION ---
// CHANGE THIS TO YOUR REPO: user/repo
const GITHUB_REPO = "robotnikz/WinBorgManager"; 

let mainWindow;
let tray = null;
let isQuitting = false;
let closeToTray = false; // Default: Close quits app

// --- SCHEDULER STATE ---
let scheduledJobs = [];
let availableRepos = [];
let schedulerInterval = null;

// Keep track of active mount processes to kill them on exit/unmount
const activeMounts = new Map();
// Keep track of general active processes
const activeProcesses = new Map();

// POWER BLOCKER STATE
let powerBlockerId = null;

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
              new Notification({ title: 'WinBorg', body: 'Running in background. Click tray icon to open.' }).show();
              return false;
          }
      }
  });
}

// --- POWER SAVE BLOCKER ---
function updatePowerBlocker() {
    const isBusy = activeProcesses.size > 0 || activeMounts.size > 0;
    
    if (isBusy && !powerBlockerId) {
        powerBlockerId = powerSaveBlocker.start('prevent-app-suspension');
        console.log(`[Power] Blocking Sleep (ID: ${powerBlockerId}) - Tasks Running`);
    } else if (!isBusy && powerBlockerId !== null) {
        powerSaveBlocker.stop(powerBlockerId);
        console.log(`[Power] Unblocking Sleep (ID: ${powerBlockerId}) - All Idle`);
        powerBlockerId = null;
    }
    updateTrayMenu(); // Also update tray to reflect status
}

function createTray() {
    const iconPath = getIconPath();
    if (!iconPath) {
        console.warn("No icon path found");
        return; 
    }
    
    try {
        const image = nativeImage.createFromPath(iconPath);
        if (image.isEmpty()) return;

        const trayIcon = image.resize({ width: 16, height: 16 });
        
        tray = new Tray(trayIcon);
        tray.setToolTip('WinBorg Manager');
        
        updateTrayMenu();
        
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

function updateTrayMenu() {
    if (!tray) return;

    const template = [
        { label: 'WinBorg Manager', enabled: false },
        { label: activeProcesses.size > 0 ? `Running: ${activeProcesses.size} Tasks` : 'Status: Idle', enabled: false },
        { type: 'separator' },
        { label: 'Open Dashboard', click: () => mainWindow.show() },
        { type: 'separator' }
    ];

    // Add Jobs
    if (scheduledJobs.length > 0) {
        template.push({ label: 'Run Backup Job', enabled: false });
        scheduledJobs.forEach(job => {
            template.push({
                label: `▶ ${job.name}`,
                click: () => executeBackgroundJob(job)
            });
        });
        template.push({ type: 'separator' });
    }

    // Add Active Mounts
    if (activeMounts.size > 0) {
        template.push({ label: 'Active Mounts', enabled: false });
        // Since activeMounts is a Map<id, process>, we don't have the path readily available in the main process map purely
        // Simplification: Just offer a generic "Unmount All" or rely on dashboard for specifics.
        // For better UX, we could store metadata in activeMounts.
        template.push({
            label: 'Stop All Mounts',
            click: () => {
                activeMounts.forEach((proc, id) => {
                    proc.kill();
                    activeMounts.delete(id);
                });
                updatePowerBlocker();
                if(mainWindow) mainWindow.webContents.send('mount-exited', { mountId: 'all', code: 0 });
            }
        });
        template.push({ type: 'separator' });
    }

    template.push({ label: 'Check for Updates', click: () => checkForUpdates(true) });
    template.push({ type: 'separator' });
    template.push({ label: 'Quit', click: () => {
        isQuitting = true;
        app.quit();
    }});

    const contextMenu = Menu.buildFromTemplate(template);
    tray.setContextMenu(contextMenu);
}

// --- SCHEDULER LOGIC ---

function startScheduler() {
    if (schedulerInterval) clearInterval(schedulerInterval);
    
    console.log("[Scheduler] Started. Checking every 60s.");
    
    // Check every 60 seconds
    schedulerInterval = setInterval(() => {
        const now = new Date();
        const currentHour = String(now.getHours()).padStart(2, '0');
        const currentMinute = String(now.getMinutes()).padStart(2, '0');
        const timeString = `${currentHour}:${currentMinute}`;
        
        // Find jobs due NOW
        scheduledJobs.forEach(job => {
            if (!job.scheduleEnabled) return;
            
            // Check Daily Schedule
            if (job.scheduleType === 'daily' && job.scheduleTime === timeString) {
                executeBackgroundJob(job);
            }
            
            // Check Hourly Schedule (at minute 00)
            if (job.scheduleType === 'hourly' && currentMinute === '00') {
                executeBackgroundJob(job);
            }
        });
    }, 60000); // 60s check
}

async function executeBackgroundJob(job) {
    console.log(`[Scheduler] Triggering Job: ${job.name}`);
    
    const repo = availableRepos.find(r => r.id === job.repoId);
    if (!repo) {
        console.error(`[Scheduler] Repo not found for job ${job.name}`);
        return;
    }

    new Notification({ title: 'Backup Started', body: `Job: ${job.name}` }).show();
    
    // NOTIFY FRONTEND
    if (mainWindow) mainWindow.webContents.send('job-started', job.id);

    // 1. Prepare Command Args
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
    const archiveName = `${job.archivePrefix}-${dateStr}-${timeStr}`;
    
    const useWsl = true; // Hardcoded default fallback
    
    let sourcePath = job.sourcePath;
    if (useWsl && /^[a-zA-Z]:[\\/]/.test(sourcePath)) {
         const drive = sourcePath.charAt(0).toLowerCase();
         const rest = sourcePath.slice(3).replace(/\\/g, '/');
         sourcePath = `/mnt/${drive}/${rest}`;
    }

    const createArgs = ['create', '--stats', `${repo.url}::${archiveName}`, sourcePath];
    if (job.compression && job.compression !== 'auto') {
        createArgs.unshift(job.compression);
        createArgs.unshift('--compression');
    }

    // 2. Execute Creation
    const createResult = await runBorgInternal(createArgs, repo.id, useWsl, job.name);
    
    if (createResult.success) {
        // 3. Prune if needed
        if (job.pruneEnabled) {
            const pruneArgs = ['prune', '-v', '--list', repo.url];
            if (job.keepDaily) pruneArgs.push('--keep-daily', job.keepDaily.toString());
            if (job.keepWeekly) pruneArgs.push('--keep-weekly', job.keepWeekly.toString());
            if (job.keepMonthly) pruneArgs.push('--keep-monthly', job.keepMonthly.toString());
            if (job.keepYearly) pruneArgs.push('--keep-yearly', job.keepYearly.toString());
            
            await runBorgInternal(pruneArgs, repo.id, useWsl, job.name + " (Prune)");
        }
        
        new Notification({ title: 'Backup Success', body: `Job '${job.name}' finished.` }).show();
        
        // Notify Frontend to refresh if open
        if (mainWindow) mainWindow.webContents.send('job-complete', { jobId: job.id, success: true });
        
    } else {
        new Notification({ title: 'Backup Failed', body: `Job '${job.name}' failed. Check logs.` }).show();
        if (mainWindow) mainWindow.webContents.send('job-complete', { jobId: job.id, success: false });
    }
}

// Internal helper to run borg without IPC event
function runBorgInternal(args, repoId, useWsl, jobName) {
    return new Promise((resolve) => {
        // Manually register "internal" process for power blocker
        const internalId = `bg-${Date.now()}`;
        activeProcesses.set(internalId, { kill: () => {} }); // Dummy object just for count
        updatePowerBlocker();

        let bin = 'borg';
        let finalArgs = args;
        const envVars = {
            BORG_UNKNOWN_UNENCRYPTED_REPO_ACCESS_IS_OK: 'yes',
            BORG_RELOCATED_REPO_ACCESS_IS_OK: 'yes',
            BORG_DISPLAY_PASSPHRASE: 'no',
            BORG_RSH: 'ssh -o BatchMode=yes -o StrictHostKeyChecking=no'
        };

        const secret = getDecryptedPassword(repoId);
        if (secret) envVars.BORG_PASSPHRASE = secret;

        if (useWsl) {
            bin = 'wsl';
            if (process.env.WSLENV) {
                 envVars.WSLENV = process.env.WSLENV + ':BORG_PASSPHRASE:BORG_RSH';
            } else {
                 envVars.WSLENV = 'BORG_PASSPHRASE:BORG_RSH';
            }
            finalArgs = ['--exec', 'borg', ...args];
        }

        const child = spawn(bin, finalArgs, { env: { ...process.env, ...envVars } });
        
        // Replace dummy with real child
        activeProcesses.set(internalId, child);

        let output = '';
        child.stdout.on('data', d => output += d);
        child.stderr.on('data', d => output += d);

        child.on('close', (code) => {
            activeProcesses.delete(internalId);
            updatePowerBlocker();

            console.log(`[Background Job] ${jobName} finished with code ${code}`);
            
            if (mainWindow) {
                mainWindow.webContents.send('activity-log', {
                    title: code === 0 ? 'Scheduled Backup Success' : 'Scheduled Backup Failed',
                    detail: `${jobName} - Code ${code}`,
                    status: code === 0 ? 'success' : 'error',
                    cmd: output
                });
            }
            resolve({ success: code === 0 });
        });
    });
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
    startScheduler(); // START TICKER
    
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
    if (schedulerInterval) clearInterval(schedulerInterval);
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

// NEW: SYNC JOBS FROM FRONTEND
ipcMain.on('sync-scheduler-data', (event, { jobs, repos }) => {
    console.log(`[Scheduler] Synced ${jobs.length} jobs and ${repos.length} repos.`);
    scheduledJobs = jobs;
    availableRepos = repos;
    updateTrayMenu();
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
        
        // --- IMPROVED ENV VAR HANDLING FOR WSL ---
        // Some Borg commands (like destroy/delete repo) rely on environment variables (BORG_DELETE_I_KNOW_...)
        // WSLENV can sometimes fail to propagate these correctly depending on Windows version/config.
        // We will explicitly inject critical variables into the command string using 'sh -c'.
        
        const criticalVars = [
            'BORG_DELETE_I_KNOW_WHAT_I_AM_DOING',
            'BORG_UNKNOWN_UNENCRYPTED_REPO_ACCESS_IS_OK',
            'BORG_RELOCATED_REPO_ACCESS_IS_OK'
        ];
        
        let inlineEnvStr = '';
        criticalVars.forEach(key => {
            if (vars[key]) {
                inlineEnvStr += `export ${key}='${vars[key]}'; `;
            }
        });

        // Always use sh -c if we have inline vars OR a cwd, to ensure the shell environment is correct.
        if (cwd || inlineEnvStr.length > 0) {
            let cmdParts = [];
            
            if (cwd) {
                let wslCwd = cwd;
                if (/^[a-zA-Z]:/.test(cwd)) {
                    const drive = cwd.charAt(0).toLowerCase();
                    const pathPart = cwd.slice(2).replace(/\\/g, '/');
                    wslCwd = `/mnt/${drive}${pathPart}`;
                }
                cmdParts.push(`cd "${wslCwd}"`);
            }
            
            // Basic escaping for args in shell string
            const safeArgs = args.map(a => `"${a.replace(/(["'$`\\])/g,'\\$1')}"`).join(' ');
            
            // Compose: export VAR=val; borg args...
            cmdParts.push(`${inlineEnvStr}${targetBinary} ${safeArgs}`);
            
            const fullCmd = cmdParts.join(' && ');
            finalArgs = wslUser ? ['-u', wslUser, '--exec', 'sh', '-c', fullCmd] : ['--exec', 'sh', '-c', fullCmd];
        } else {
            // Standard execution relying on WSLENV for basic things like BORG_PASSPHRASE
            // We still need to set up WSLENV for non-inlined vars (like Passphrase)
            
            let wslEnvParts = vars.WSLENV ? vars.WSLENV.split(':') : [];
            if (process.env.WSLENV) {
                wslEnvParts = [...process.env.WSLENV.split(':'), ...wslEnvParts];
            }
            
            if (!wslEnvParts.includes('BORG_PASSPHRASE')) wslEnvParts.push('BORG_PASSPHRASE');
            if (!wslEnvParts.includes('BORG_RSH')) wslEnvParts.push('BORG_RSH');
            
            const uniqueParts = [...new Set(wslEnvParts)];
            vars.WSLENV = uniqueParts.join(':');
            
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
        updatePowerBlocker();

        child.stdout.on('data', (data) => {
          if (mainWindow) mainWindow.webContents.send('terminal-log', { id: commandId, text: data.toString() });
        });

        child.stderr.on('data', (data) => {
          const text = data.toString();
          if (mainWindow) mainWindow.webContents.send('terminal-log', { id: commandId, text: text });
        });

        child.on('close', (code) => {
          activeProcesses.delete(commandId);
          updatePowerBlocker();
          resolve({ success: code === 0, code });
        });

        child.on('error', (err) => {
          activeProcesses.delete(commandId);
          updatePowerBlocker();
          if (mainWindow) mainWindow.webContents.send('terminal-log', { id: commandId, text: `Error: ${err.message}` });
          resolve({ success: false, error: err.message });
        });
    } catch (e) {
        activeProcesses.delete(commandId);
        updatePowerBlocker();
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
        
        let wslEnvParts = vars.WSLENV ? vars.WSLENV.split(':') : [];
        if (process.env.WSLENV) wslEnvParts = [...process.env.WSLENV.split(':'), ...wslEnvParts];
        if (!wslEnvParts.includes('BORG_PASSPHRASE')) wslEnvParts.push('BORG_PASSPHRASE');
        const uniqueParts = [...new Set(wslEnvParts)];
        vars.WSLENV = uniqueParts.join(':');

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
        updatePowerBlocker();
        updateTrayMenu();

        child.stderr.on('data', (data) => {
          const text = data.toString();
          if (mainWindow) mainWindow.webContents.send('terminal-log', { id: 'mount', text: text });
        });

        child.on('close', (code) => {
          activeMounts.delete(mountId);
          updatePowerBlocker();
          updateTrayMenu();
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
        updatePowerBlocker();
        updateTrayMenu();
    }
    const cmd = useWsl ? `wsl --exec fusermount3 -u -z ${localPath}` : `"${executablePath||'borg'}" umount ${localPath}`;
    exec(cmd, () => resolve({ success: true }));
  });
});
