

// This service communicates with the Electron Main process

import { formatBytes, formatDuration } from '../utils/formatters';

// Helper to safely get ipcRenderer without crashing in Browser mode
const getIpcRenderer = () => {
    try {
        if ((window as any).require) {
            const electron = (window as any).require('electron');
            return electron.ipcRenderer;
        }
    } catch (e) {
        console.warn("Electron require failed", e);
    }
    
    // Fallback for Browser/Dev mode (Prevents White Screen crash)
    console.warn("WinBorg: Running in browser/mock mode. Electron features disabled.");
    return {
        invoke: async () => ({ success: false, error: "Running in browser mode (Mock)" }),
        send: () => {},
        on: () => {},
        removeListener: () => {}
    };
};

// Initialize lazily
const ipcRenderer = getIpcRenderer();

const getBorgConfig = () => {
    const storedWsl = localStorage.getItem('winborg_use_wsl');
    const useWsl = storedWsl === null ? true : storedWsl === 'true';

    return {
        useWsl: useWsl,
        path: localStorage.getItem('winborg_executable_path') || 'borg',
        disableHostCheck: localStorage.getItem('winborg_disable_host_check') === 'true'
    };
};

const getEnvVars = (config: any, overrides?: { disableHostCheck?: boolean }) => {
    const finalDisableHostCheck = overrides?.disableHostCheck !== undefined ? overrides.disableHostCheck : config.disableHostCheck;

    const env: any = {
        // BORG_PASSPHRASE is now injected by the MAIN process securely
        BORG_UNKNOWN_UNENCRYPTED_REPO_ACCESS_IS_OK: 'yes',
        BORG_RELOCATED_REPO_ACCESS_IS_OK: 'yes',
        BORG_DISPLAY_PASSPHRASE: 'no' 
    };
    
    let sshCmd = 'ssh -o BatchMode=yes';
    if (finalDisableHostCheck) {
        sshCmd += ' -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null';
    }
    env.BORG_RSH = sshCmd;
    
    if (config.useWsl) {
        env.WSLENV = 'BORG_PASSPHRASE:BORG_DISPLAY_PASSPHRASE:BORG_UNKNOWN_UNENCRYPTED_REPO_ACCESS_IS_OK:BORG_RELOCATED_REPO_ACCESS_IS_OK:BORG_RSH';
    }
    
    return env;
};

// Helper to extract JSON from mixed output (stdout + stderr)
const extractJson = (text: string) => {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start > -1 && end > start) {
        return text.substring(start, end + 1);
    }
    return null;
};

// Helper to parse URL
const parseBorgUrl = (url: string) => {
    const sshRegex = /^ssh:\/\/(?:([^@]+)@)?([^:/]+)(?::(\d+))?(.*)$/;
    const sshMatch = url.match(sshRegex);
    
    if (sshMatch) {
        return {
            isSsh: true,
            user: sshMatch[1], 
            host: sshMatch[2],
            port: sshMatch[3] || '22',
            path: sshMatch[4] 
        };
    }
    
    const scpMatch = url.match(/^([^@]+)@([^:]+):(.*)$/);
    if (scpMatch) {
        return {
            isSsh: true,
            user: scpMatch[1],
            host: scpMatch[2],
            port: '22',
            path: scpMatch[3]
        };
    }
    return { isSsh: false, path: url };
};

export const borgService = {
  
  // --- SECRETS MANAGEMENT ---
  savePassphrase: async (repoId: string, passphrase: string) => {
      return await ipcRenderer.invoke('save-secret', { repoId, passphrase });
  },

  deletePassphrase: async (repoId: string) => {
      return await ipcRenderer.invoke('delete-secret', { repoId });
  },

  hasPassphrase: async (repoId: string): Promise<boolean> => {
      const res = await ipcRenderer.invoke('has-secret', { repoId });
      return res.hasSecret;
  },

  // --- COMMANDS ---

  /**
   * Run a one-off borg command
   * Pass repoId in overrides to inject the secure password from backend
   */
  runCommand: async (
    args: string[], 
    onLog: (text: string) => void,
    overrides?: { repoId?: string, disableHostCheck?: boolean, commandId?: string, forceBinary?: string }
  ): Promise<boolean> => {
    const commandId = overrides?.commandId || Math.random().toString(36).substring(7);
    const config = getBorgConfig();

    const logListener = (_: any, msg: { id: string, text: string }) => {
      if (msg.id === commandId) onLog(msg.text);
    };

    ipcRenderer.on('terminal-log', logListener);

    try {
      const result = await ipcRenderer.invoke('borg-spawn', { 
          args, 
          commandId, 
          useWsl: config.useWsl,
          executablePath: config.path,
          envVars: getEnvVars(config, overrides),
          forceBinary: overrides?.forceBinary,
          repoId: overrides?.repoId // SECURE INJECTION TRIGGER
      });
      return result.success;
    } finally {
      ipcRenderer.removeListener('terminal-log', logListener);
    }
  },

  initRepo: async (
      repoUrl: string, 
      encryption: 'repokey' | 'keyfile' | 'none', 
      onLog: (text: string) => void,
      overrides?: { repoId?: string, disableHostCheck?: boolean }
  ): Promise<boolean> => {
      // Argument Mapping: repokey -> repokey-blake2 (modern default), keyfile -> keyfile-blake2
      let encMode: string = encryption;
      if (encryption === 'repokey') encMode = 'repokey-blake2';
      if (encryption === 'keyfile') encMode = 'keyfile-blake2';

      const args = ['init', '--encryption', encMode, repoUrl];
      return await borgService.runCommand(args, onLog, overrides);
  },

  compact: async (repoUrl: string, onLog: (text: string) => void, overrides?: { repoId?: string, disableHostCheck?: boolean }) => {
      return await borgService.runCommand(['compact', '-v', repoUrl], onLog, overrides);
  },

  prune: async (
      repoUrl: string,
      rules: { daily?: number, weekly?: number, monthly?: number, keepWithin?: string },
      onLog: (text: string) => void,
      overrides?: { repoId?: string, disableHostCheck?: boolean }
  ): Promise<boolean> => {
      const args = ['prune', '-v', '--list', repoUrl];
      if (rules.keepWithin) args.push('--keep-within', rules.keepWithin);
      if (rules.daily) args.push('--keep-daily', rules.daily.toString());
      if (rules.weekly) args.push('--keep-weekly', rules.weekly.toString());
      if (rules.monthly) args.push('--keep-monthly', rules.monthly.toString());
      return await borgService.runCommand(args, onLog, overrides);
  },

  exportKey: async (repoUrl: string, onLog: (text: string) => void, overrides?: { repoId?: string, disableHostCheck?: boolean }) => {
      // export to stdout
      return await borgService.runCommand(['key', 'export', repoUrl], onLog, overrides);
  },

  ensureFuseConfig: async (onLog: (text: string) => void): Promise<boolean> => {
      const config = getBorgConfig();
      if (!config.useWsl) return true;

      onLog("[Auto-Setup] Checking FUSE permissions in WSL...");
      const fixCmd = `
        touch /etc/fuse.conf && 
        sed -i 's/^#\\s*user_allow_other/user_allow_other/' /etc/fuse.conf &&
        if ! grep -q "^user_allow_other" /etc/fuse.conf; then 
            echo "user_allow_other" >> /etc/fuse.conf; 
        fi && 
        chmod 666 /dev/fuse &&
        echo "FUSE permissions verified."
      `;
      const logListener = (_: any, msg: { id: string, text: string }) => {
        if (msg.id === 'fuse-setup') onLog(`[Setup] ${msg.text}`);
      };
      ipcRenderer.on('terminal-log', logListener);

      try {
        return await ipcRenderer.invoke('borg-spawn', { 
            commandId: 'fuse-setup', 
            useWsl: true,
            envVars: {},
            forceBinary: 'bash',
            wslUser: 'root', 
            args: ['-c', fixCmd]
        }).then((res: any) => res.success);
      } catch (e: any) {
          onLog(`[Setup Error] ${e.message}`);
          return false;
      } finally {
          ipcRenderer.removeListener('terminal-log', logListener);
      }
  },

  checkLockStatus: async (repoUrl: string, overrides?: { disableHostCheck?: boolean }) => {
      const parsed = parseBorgUrl(repoUrl);
      if (!parsed) return false;
      
      const config = getBorgConfig();
      const basePath = parsed.path?.replace(/\/$/, '') || '';
      const lockFile = `${basePath}/lock.roster`;
      const testCmd = `test -e "${lockFile}"`;
      
      let success = false;
      const noOpLog = () => {};

      if (parsed.isSsh) {
           const userHost = `${parsed.user ? parsed.user + '@' : ''}${parsed.host}`;
           const args = [
              '-p', parsed.port!,
              ...(overrides?.disableHostCheck || config.disableHostCheck ? ['-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null'] : []),
              '-o', 'BatchMode=yes',
              userHost,
              testCmd
           ];
           success = await borgService.runCommand(args, noOpLog, { forceBinary: 'ssh', commandId: `lock-check-${Date.now()}` });
      } else {
           if (config.useWsl) {
               success = await borgService.runCommand([testCmd], noOpLog, { forceBinary: 'wsl', commandId: `lock-check-${Date.now()}` });
           } else {
               const psCmd = `Test-Path "${lockFile}"`;
               success = await borgService.runCommand(['-Command', psCmd], noOpLog, { forceBinary: 'powershell', commandId: `lock-check-${Date.now()}` });
           }
      }
      return success;
  },

  breakLock: async (repoUrl: string, onLog: (text: string) => void, overrides?: { repoId?: string, disableHostCheck?: boolean }) => {
      return await borgService.runCommand(['break-lock', repoUrl], onLog, overrides);
  },
  
  forceDeleteLockFiles: async (repoUrl: string, onLog: (text: string) => void, overrides?: { disableHostCheck?: boolean }) => {
      const parsed = parseBorgUrl(repoUrl);
      if (!parsed) return false;
      const config = getBorgConfig();

      if (parsed.isSsh) {
          const userHost = `${parsed.user ? parsed.user + '@' : ''}${parsed.host}`;
          if (!parsed.host) return false;
          const basePath = parsed.path!;
          const removeCmd = `rm -rf "${basePath}/lock.roster" "${basePath}/lock.exclusive"`;
          
          onLog(`Connecting to ${userHost} (Port ${parsed.port}) via SSH...`);
          const args = [
              '-p', parsed.port!,
              ...(overrides?.disableHostCheck || config.disableHostCheck ? ['-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null'] : []),
              '-o', 'BatchMode=yes',
              userHost,
              removeCmd
          ];
          return await borgService.runCommand(args, onLog, { ...overrides, forceBinary: 'ssh' });
      } else {
          const basePath = parsed.path!;
          const rosterPath = `${basePath}/lock.roster`;
          const exclusivePath = `${basePath}/lock.exclusive`;
          onLog(`Deleting local lock files in: ${basePath}`);
          
          if (config.useWsl) {
               return await borgService.runCommand(['-rf', rosterPath, exclusivePath], onLog, { ...overrides, forceBinary: 'rm' });
          } else {
              onLog("Manual local deletion on Native Windows not fully supported via UI.");
              return false;
          }
      }
  },

  getArchiveInfo: async (repoUrl: string, archiveName: string, overrides?: { repoId?: string, disableHostCheck?: boolean }) => {
      let outputBuffer = "";
      const success = await borgService.runCommand(
          ['info', '--json', `${repoUrl}::${archiveName}`],
          (log) => { outputBuffer += log; },
          overrides
      );

      if (success) {
          const jsonStr = extractJson(outputBuffer);
          if (jsonStr) {
              try {
                  const data = JSON.parse(jsonStr);
                  const stats = data.archives?.[0]?.stats || data.archive?.stats;
                  const duration = data.archives?.[0]?.duration || data.archive?.duration || 0;
                  if (stats) {
                      return {
                          size: formatBytes(stats.deduplicated_size || stats.compressed_size),
                          duration: formatDuration(duration)
                      };
                  }
              } catch (e) {
                  console.error("Failed to parse archive info", e);
              }
          }
      }
      return null;
  },

  stopCommand: async (commandId: string): Promise<boolean> => {
      const result = await ipcRenderer.invoke('borg-stop', { commandId });
      return result.success;
  },

  mount: async (repoUrl: string, archiveName: string, mountPoint: string, onLog: (text: string) => void, overrides?: { repoId?: string, disableHostCheck?: boolean }) => {
    const mountId = `mount-${Date.now()}`;
    const config = getBorgConfig();
    const logListener = (_: any, msg: { id: string, text: string }) => {
        if (msg.id === 'mount') onLog(msg.text);
    };
    ipcRenderer.on('terminal-log', logListener);

    try {
        if (config.useWsl) await borgService.ensureFuseConfig(onLog);
        
        const args = ['mount', '--foreground', '-o', 'allow_other', `${repoUrl}::${archiveName}`, mountPoint];
        const result = await ipcRenderer.invoke('borg-mount', { 
            args, 
            mountId, 
            useWsl: config.useWsl,
            executablePath: config.path,
            envVars: getEnvVars(config, overrides),
            repoId: overrides?.repoId
        });
        
        return { success: result.success, mountId: result.success ? mountId : undefined, error: result.error };
    } finally {
        ipcRenderer.removeListener('terminal-log', logListener);
    }
  },

  unmount: async (mountId: string, localPath: string) => {
    const config = getBorgConfig();
    return await ipcRenderer.invoke('borg-unmount', { 
        mountId, 
        localPath, 
        useWsl: config.useWsl,
        executablePath: config.path 
    });
  },

  selectDirectory: async (): Promise<string[] | null> => {
      try {
        const result = await ipcRenderer.invoke('select-directory');
        return !result.canceled ? result.filePaths : null;
      } catch (e) {
          console.error("Failed to select directory", e);
          return null;
      }
  },

  notify: (title: string, body: string) => {
      if (!('Notification' in window)) return;
      
      if (Notification.permission === 'granted') {
          new Notification(title, { body });
      } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then(permission => {
              if (permission === 'granted') {
                  new Notification(title, { body });
              }
          });
      }
  }
};
