export enum View {
  DASHBOARD = 'DASHBOARD',
  REPOSITORIES = 'REPOSITORIES',
  MOUNTS = 'MOUNTS',
  ARCHIVES = 'ARCHIVES',
  SETTINGS = 'SETTINGS'
}

export interface Repository {
  id: string;
  name: string;
  url: string; // ssh://user@host:port/path
  lastBackup: string;
  encryption: 'repokey' | 'keyfile' | 'none';
  status: 'connected' | 'disconnected' | 'error';
  size: string;
  fileCount: number;
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