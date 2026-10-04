/**
 * Parse composite node ID "<accountId>:<driveFileId>"
 * Root node is "root"
 */
export function parseCompositeId(compositeId: string): { accountId: string; driveId: string } | null {
  if (!compositeId || compositeId === 'root' || compositeId === '/') {
    return null;
  }
  const parts = compositeId.split(':');
  if (parts.length >= 2) {
    const accountId = parts[0];
    const driveId = parts.slice(1).join(':');
    return { accountId, driveId };
  }
  return null;
}

/**
 * Format account and drive ID into composite ID
 */
export function makeCompositeId(accountId: string, driveId: string): string {
  return `${accountId}:${driveId}`;
}

/**
 * Format bytes into human-readable string (e.g. 1.4 GB)
 */
export function formatBytes(bytes: number | string | bigint | null | undefined, decimals = 1): string {
  if (bytes === null || bytes === undefined) return '--';
  const num = typeof bytes === 'bigint' ? Number(bytes) : Number(bytes);
  if (isNaN(num)) return '--';
  if (num === 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(num) / Math.log(k));

  if (i >= sizes.length) return (num / Math.pow(k, sizes.length - 1)).toFixed(dm) + ' ' + sizes[sizes.length - 1];
  return parseFloat((num / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format date string
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '--';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '--';
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  } else if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } else {
    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  }
}

/**
 * Check if MIME type is a native Google App (Docs, Sheets, Slides, etc.)
 */
export function isGoogleDoc(mimeType: string): boolean {
  return mimeType.startsWith('application/vnd.google-apps.') && !isGoogleDriveFolder(mimeType);
}

export function isGoogleDriveFolder(mimeType: string): boolean {
  return mimeType === 'application/vnd.google-apps.folder';
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length > 1) {
    return parts.pop()?.toLowerCase() || '';
  }
  return '';
}

export function getFileTypeCategory(mimeType: string, filename = ''): 'folder' | 'document' | 'spreadsheet' | 'presentation' | 'pdf' | 'image' | 'video' | 'audio' | 'archive' | 'code' | 'text' | 'file' {
  if (isGoogleDriveFolder(mimeType) || mimeType === 'folder') return 'folder';
  
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  
  if (
    mimeType.includes('word') || 
    mimeType === 'application/vnd.google-apps.document' || 
    mimeType.includes('officedocument.wordprocessingml')
  ) return 'document';

  if (
    mimeType.includes('sheet') || 
    mimeType.includes('excel') || 
    mimeType === 'application/vnd.google-apps.spreadsheet' || 
    mimeType.includes('officedocument.spreadsheetml')
  ) return 'spreadsheet';

  if (
    mimeType.includes('presentation') || 
    mimeType.includes('powerpoint') || 
    mimeType === 'application/vnd.google-apps.presentation' || 
    mimeType.includes('officedocument.presentationml')
  ) return 'presentation';

  if (
    mimeType.includes('zip') || 
    mimeType.includes('tar') || 
    mimeType.includes('gzip') || 
    mimeType.includes('compressed') || 
    mimeType.includes('7z') || 
    mimeType.includes('rar')
  ) return 'archive';

  const ext = getFileExtension(filename);
  const codeExtensions = ['js', 'ts', 'jsx', 'tsx', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'html', 'css', 'json', 'yml', 'yaml', 'md', 'sh', 'sql', 'php', 'rb'];
  if (codeExtensions.includes(ext) || mimeType.includes('javascript') || mimeType.includes('json') || mimeType.includes('typescript') || mimeType.includes('xml')) {
    return 'code';
  }

  if (mimeType.startsWith('text/')) return 'text';

  return 'file';
}

/**
 * Determine if file can be edited via Monaco Editor
 */
export function isEditableText(mimeType: string, filename: string): boolean {
  if (isGoogleDoc(mimeType)) return false;
  if (mimeType.startsWith('text/')) return true;
  if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('xml')) return true;
  
  const ext = getFileExtension(filename);
  const textExtensions = [
    'txt', 'md', 'markdown', 'json', 'js', 'ts', 'jsx', 'tsx', 'html', 'htm', 'css', 'scss', 'less',
    'py', 'sh', 'bash', 'zsh', 'env', 'yml', 'yaml', 'toml', 'ini', 'cfg', 'conf', 'xml', 'svg',
    'sql', 'graphql', 'rs', 'go', 'c', 'h', 'cpp', 'hpp', 'java', 'kt', 'php', 'rb', 'lua'
  ];
  return textExtensions.includes(ext);
}
