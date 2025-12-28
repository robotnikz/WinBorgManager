// This service communicates with the Electron Main process

// Since we are in Electron with nodeIntegration: true, we can require electron
const { ipcRenderer } = (window as any).require('electron');

const getBorgConfig = () => {
    return {
        useWsl: localStorage.getItem('winborg_use_wsl') === 'true',
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
    
    // If using WSL, we need to tell Windows to pass these variables into the WSL instance
    if (config.useWsl) {
        // /u flag for WSLENV means "translate path", but for simple strings (passwords), just passing the name is usually enough.
        // However, standard env vars need to be listed in WSLENV to be visible inside WSL.
        env.WSLENV = 'BORG_PASSPHRASE/u:BORG_UNKNOWN_UNENCRYPTED_REPO_ACCESS_IS_OK/u:BORG_RELOCATED_REPO_ACCESS_IS_OK/u';
        
        if (finalDisableHostCheck) {
           env.BORG_RSH = 'ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null';
           env.WSLENV += ':BORG_RSH/u';
        }
    } else {
        if (finalDisableHostCheck) {
            env.BORG_RSH = 'ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null';
        }
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
  ): Promise<{ success: boolean; mountId?: string }> => {
    const mountId = `mount-${Date.now()}`;
    const config = getBorgConfig();
    
    // Construct args. 
    // If WSL, mountPoint is a linux path (e.g. /mnt/wsl/borg)
    // If Windows, mountPoint is a Drive Letter (e.g. Z:)
    const args = ['mount', `${repoUrl}::${archiveName}`, mountPoint];
    
    // Global log listener for mounts
    const logListener = (_: any, msg: { id: string, text: string }) => {
        if (msg.id === 'mount') {
          onLog(msg.text);
        }
    };
    ipcRenderer.on('terminal-log', logListener);

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
        return { success: false };
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