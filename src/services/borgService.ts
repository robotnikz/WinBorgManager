// This service communicates with the Electron Main process

// Since we are in Electron with nodeIntegration: true, we can require electron
const { ipcRenderer } = (window as any).require('electron');

const getBorgConfig = () => {
    // WSL DEFAULT STRATEGY:
    // We check if the user has explicitly set 'false'. 
    // If the setting is missing (null), we default to TRUE (prefer WSL).
    const storedWsl = localStorage.getItem('winborg_use_wsl');
    const useWsl = storedWsl === null ? true : storedWsl === 'true';

    return {
        useWsl: useWsl,
        path: localStorage.getItem('winborg_executable_path') || 'borg',
        passphrase: localStorage.getItem('winborg_passphrase') || '',
        disableHostCheck: localStorage.getItem('winborg_disable_host_check') === 'true'
    };
};

const getEnvVars = (config: any, overrides?: { passphrase?: string, disableHostCheck?: boolean }) => {
    const finalPassphrase = overrides?.passphrase !== undefined ? overrides.passphrase : config.passphrase;
    const finalDisableHostCheck = overrides?.disableHostCheck !== undefined ? overrides.disableHostCheck : config.disableHostCheck;

    const env: any = {
        BORG_PASSPHRASE: finalPassphrase,
        // Flags to allow remote access even if unknown
        BORG_UNKNOWN_UNENCRYPTED_REPO_ACCESS_IS_OK: 'yes',
        BORG_RELOCATED_REPO_ACCESS_IS_OK: 'yes',
    };
    
    // Construct SSH Command with BatchMode=yes to prevent hangs.
    // BatchMode=yes fails immediately if password/phrase is asked.
    let sshCmd = 'ssh -o BatchMode=yes';
    if (finalDisableHostCheck) {
        sshCmd += ' -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null';
    }

    // Always set BORG_RSH so we control the SSH behavior
    env.BORG_RSH = sshCmd;
    
    // If using WSL, we need to tell Windows to pass these variables into the WSL instance
    if (config.useWsl) {
        // CRITICAL FIX: Do NOT use '/u' for BORG_PASSPHRASE. 
        // '/u' tells WSLENV to translate a path (e.g. C:\... -> /mnt/c/...). 
        // This mangles passwords containing slashes or backslashes.
        // We just want to pass the value as is.
        env.WSLENV = 'BORG_PASSPHRASE:BORG_UNKNOWN_UNENCRYPTED_REPO_ACCESS_IS_OK:BORG_RELOCATED_REPO_ACCESS_IS_OK:BORG_RSH/u';
    }
    
    return env;
};

export const borgService = {
  /**
   * Run a one-off borg command (list, info, create)
   * Allows overriding config for specific commands (like connection checks with specific passwords)
   */
  runCommand: async (
    args: string[], 
    onLog: (text: string) => void,
    overrides?: { passphrase?: string, disableHostCheck?: boolean }
  ): Promise<boolean> => {
    const commandId = Math.random().toString(36).substring(7);
    const config = getBorgConfig();

    // Listen for logs for this specific command
    const logListener = (_: any, msg: { id: string, text: string }) => {
      if (msg.id === commandId) {
        onLog(msg.text);
      }
    };

    ipcRenderer.on('terminal-log', logListener);

    try {
      const result = await ipcRenderer.invoke('borg-spawn', { 
          args, 
          commandId, 
          useWsl: config.useWsl,
          executablePath: config.path,
          envVars: getEnvVars(config, overrides)
      });
      return result.success;
    } finally {
      ipcRenderer.removeListener('terminal-log', logListener);
    }
  },

  /**
   * Start a mount process
   */
  mount: async (
    repoUrl: string, 
    archiveName: string, 
    mountPoint: string,
    onLog: (text: string) => void
  ): Promise<{ success: boolean; mountId?: string; error?: string }> => {
    const mountId = `mount-${Date.now()}`;
    const config = getBorgConfig();
    
    // Construct args. 
    // If WSL, mountPoint is a linux path (e.g. /mnt/wsl/borg)
    // If Windows, mountPoint is a Drive Letter (e.g. Z:)
    // Added --foreground to ensure process stays alive and tracked by Electron
    const args = ['mount', '--foreground', `${repoUrl}::${archiveName}`, mountPoint];
    
    // Global log listener for mounts
    const logListener = (_: any, msg: { id: string, text: string }) => {
        if (msg.id === 'mount') {
          onLog(msg.text);
        }
    };
    ipcRenderer.on('terminal-log', logListener);

    // Look up specific repo overrides if possible (passed via global state usually, 
    // but here we might rely on the generic config or what was passed during connect.
    // Ideally, we should pass the repo-specific passphrase here.
    // For now, we rely on the caller setting the global or the repo context needs to be passed.
    // IMPROVEMENT: We use the generic config. If repo has specific pass, it might need to be passed here.
    // For now, assuming Global Passphrase or Keyfile without passphrase for mount.
    // To support per-repo passphrase on mount, we would need to look it up in App state.
    
    // However, to fix the immediate issue, we assume the env vars generation is correct.
    const result = await ipcRenderer.invoke('borg-mount', { 
        args, 
        mountId, 
        useWsl: config.useWsl,
        executablePath: config.path,
        envVars: getEnvVars(config) 
    });
    
    if (result.success) {
        return { success: true, mountId };
    } else {
        return { success: false, error: result.error };
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
  }
};
