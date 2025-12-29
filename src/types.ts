
export enum View {
  DASHBOARD = 'DASHBOARD',
  REPOSITORIES = 'REPOSITORIES',
  MOUNTS = 'MOUNTS',
  ARCHIVES = 'ARCHIVES',
  SETTINGS = 'SETTINGS',
  ACTIVITY = 'ACTIVITY'
}

export interface Repository {
  id: string;
  name: string;
  url: string; // ssh://user@host:port/path
  lastBackup: string;
  encryption: 'repokey' | 'keyfile' | 'none';
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  size: string;
  fileCount: number;
  // Security / Config Persistence
  passphrase?: string;
  trustHost?: boolean;
  
  // Integrity Check State
  checkStatus?: 'idle' | 'running' | 'ok' | 'error' | 'aborted';
  checkProgress?: number; // 0-100
  checkStartTime?: number; // Timestamp in ms
  lastCheckTime?: string;
  
  // Lock State
  isLocked?: boolean;
  
  // To allow aborting
  activeCommandId?: string;
}

export interface BackupJob {
    id: string;
    repoId: string;
    name: string;          // Friendly name e.g. "Work Documents"
    sourcePath: string;    // Local path
    archivePrefix: string; // e.g. "work-docs" (Timestamp will be appended)
    lastRun: string;       // ISO Date
    status: 'idle' | 'running' | 'success' | 'error';
}

export interface Archive {
  id: string;
  name: string;
  time: string;
  size: string;
  duration: string;
}

export interface MountPoint {
  id: string;
  repoId: string;
  archiveName: string;
  localPath: string; // e.g., "Z:\" or "C:\Mounts\Borg"
  status: 'mounted' | 'unmounting' | 'error';
  processId?: number;
}

export interface ActivityLogEntry {
  id: string;
  title: string;
  detail: string;
  time: string; // ISO string
  status: 'success' | 'warning' | 'error' | 'info';
  cmd?: string;
}
