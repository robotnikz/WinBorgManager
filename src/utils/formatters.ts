
export const parseSizeString = (sizeStr: string): number => {
  if (!sizeStr || sizeStr === 'Unknown') return 0;
  const units = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024
  };
  
  const regex = /(\d+(\.\d+)?)\s*(B|KB|MB|GB|TB)/i;
  const match = sizeStr.match(regex);
  
  if (match) {
    const value = parseFloat(match[1]);
    const unit = match[3].toUpperCase();
    return value * (units[unit as keyof typeof units] || 1);
  }
  return 0;
};

export const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};
