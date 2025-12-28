// This service communicates with the Electron Main process

// Since we are in Electron with nodeIntegration: true, we can require electron
const { ipcRenderer } = (window as any).require('electron');

const getBorgConfig = () => {
    return {
        path: localStorage.getItem('winborg_executable_path') || 'borg',
        passphrase: localStorage.getItem('winborg_passphrase') || '',
        disableHostCheck: localStorage.getItem('winborg_disable_host_check') === 'true'
    };
};

const getEnvVars = (config: any) => {
    const env: any = {
        BORG_PASSPHRASE: config.passphrase
    };
    
    // If disabled, set BORG_RSH to ssh with strict checking disabled
    if (config.disableHostCheck) {
        env.BORG_RSH = 'ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null';
    }
    
    return env;
};

export const borgService = {
  /**
   * Run a one-off borg command (list, info, create)
   */
  runCommand: async (
    args: string[], 
    onLog: (text: string) => void
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
          executablePath: config.path,
          envVars: getEnvVars(config)
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
    
    // Note for Windows: WinFSP handles the drive mapping
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
        executablePath: config.path 
    });
  }
};