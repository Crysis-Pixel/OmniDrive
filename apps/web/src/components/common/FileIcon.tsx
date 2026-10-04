import React from 'react';
import {
  Folder,
  FileText,
  FileSpreadsheet,
  Presentation,
  FileCode,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  File,
  HardDrive,
} from 'lucide-react';
import { getFileTypeCategory, isGoogleDoc } from '@omnidrive/shared';

interface FileIconProps {
  mimeType: string;
  name: string;
  isFolder?: boolean;
  className?: string;
}

export const FileIcon: React.FC<FileIconProps> = ({ mimeType, name, isFolder, className = 'w-6 h-6' }) => {
  if (isFolder) {
    if (name.includes('@') || mimeType === 'application/vnd.google-apps.folder-account') {
      return <HardDrive className={`${className} text-brand-400`} />;
    }
    return <Folder className={`${className} text-amber-400 fill-amber-400/20`} />;
  }

  const category = getFileTypeCategory(mimeType, name);

  switch (category) {
    case 'pdf':
      return <FileText className={`${className} text-rose-500`} />;
    case 'document':
      return <FileText className={`${className} text-sky-400`} />;
    case 'spreadsheet':
      return <FileSpreadsheet className={`${className} text-emerald-400`} />;
    case 'presentation':
      return <Presentation className={`${className} text-amber-500`} />;
    case 'image':
      return <ImageIcon className={`${className} text-violet-400`} />;
    case 'video':
      return <Video className={`${className} text-purple-400`} />;
    case 'audio':
      return <Music className={`${className} text-pink-400`} />;
    case 'archive':
      return <Archive className={`${className} text-orange-400`} />;
    case 'code':
      return <FileCode className={`${className} text-cyan-400`} />;
    default:
      return <File className={`${className} text-slate-400`} />;
  }
};
