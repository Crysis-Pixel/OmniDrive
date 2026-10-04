import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import {
  X,
  Save,
  Download,
  ExternalLink,
  AlertTriangle,
  RotateCcw,
  Copy,
  FileText,
  Maximize2,
} from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { api } from '../../api/endpoints';
import {
  isEditableText,
  getFileExtension,
  isGoogleDoc,
  FileNodeDTO,
} from '@omnidrive/shared';
import { useQueryClient } from '@tanstack/react-query';

export const ViewerModal: React.FC = () => {
  const queryClient = useQueryClient();
  const { activeViewerNode, setActiveViewerNode } = useUIStore();

  const [textContent, setTextContent] = useState<string>('');
  const [initialContent, setInitialContent] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isConflict, setIsConflict] = useState(false);
  const [headRevision, setHeadRevision] = useState<string | null>(null);

  const node = activeViewerNode;
  const isDoc = node ? isGoogleDoc(node.mimeType) : false;
  const isText = node ? isEditableText(node.mimeType, node.name) : false;
  const isImage = node?.mimeType.startsWith('image/') || false;
  const isPdf = node?.mimeType === 'application/pdf' || false;
  const isVideo = node?.mimeType.startsWith('video/') || false;
  const isAudio = node?.mimeType.startsWith('audio/') || false;

  const isDirty = textContent !== initialContent;

  useEffect(() => {
    if (!node || node.isFolder) return;

    setHeadRevision(node.headRevisionId);
    setSaveError(null);
    setIsConflict(false);

    if (isText) {
      setIsLoadingContent(true);
      api.nodes
        .getFileContentText(node.id)
        .then((content) => {
          setTextContent(content);
          setInitialContent(content);
        })
        .catch((err) => {
          setSaveError('Failed to load file content: ' + err.message);
        })
        .finally(() => {
          setIsLoadingContent(false);
        });
    }
  }, [node, isText]);

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isText && isDirty) {
          handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  if (!node) return null;

  const getMonacoLanguage = (name: string): string => {
    const ext = getFileExtension(name);
    switch (ext) {
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'json':
        return 'json';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'py':
        return 'python';
      case 'md':
      case 'markdown':
        return 'markdown';
      case 'sh':
        return 'shell';
      case 'sql':
        return 'sql';
      default:
        return 'plaintext';
    }
  };

  const handleSave = async (forceOverwrite = false) => {
    if (!node) return;
    setIsSaving(true);
    setSaveError(null);
    setIsConflict(false);

    try {
      const updatedNode = await api.nodes.saveFileContent(
        node.id,
        textContent,
        forceOverwrite ? null : headRevision
      );
      setHeadRevision(updatedNode.headRevisionId);
      setInitialContent(textContent);
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
    } catch (err: any) {
      if (err.statusCode === 409 || err.message?.includes('conflict')) {
        setIsConflict(true);
      } else {
        setSaveError(err.message || 'Failed to save file');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleReload = async () => {
    if (!node) return;
    setIsLoadingContent(true);
    setIsConflict(false);
    try {
      const freshText = await api.nodes.getFileContentText(node.id);
      const freshMeta = await api.nodes.get(node.id);
      setTextContent(freshText);
      setInitialContent(freshText);
      setHeadRevision(freshMeta.node.headRevisionId);
    } finally {
      setIsLoadingContent(false);
    }
  };

  const contentUrl = `/api/nodes/${encodeURIComponent(node.id)}/content`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl h-[85vh] glass-modal rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-700/80 animate-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="h-16 px-6 border-b border-slate-800/80 bg-surface-950/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 truncate">
            <h3 className="font-bold text-base text-white truncate" title={node.name}>
              {node.name}
            </h3>
            {isText && isDirty && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Unsaved changes
              </span>
            )}
            {node.accountLabel && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400">
                {node.accountLabel}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isText && (
              <button
                onClick={() => handleSave(false)}
                disabled={isSaving || !isDirty}
                className="btn-primary py-1.5 px-3 text-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save (Ctrl+S)'}</span>
              </button>
            )}

            {!isDoc && (
              <a
                href={`${contentUrl}?download=1`}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary py-1.5 px-3 text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </a>
            )}

            {isDoc && node.webViewLink && (
              <a
                href={node.webViewLink}
                target="_blank"
                rel="noreferrer"
                className="btn-primary py-1.5 px-3 text-xs bg-sky-600 hover:bg-sky-500"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Google Drive</span>
              </a>
            )}

            <button
              onClick={() => setActiveViewerNode(null)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 409 Conflict Dialog Banner */}
        {isConflict && (
          <div className="p-4 bg-amber-500/15 border-b border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-4 animate-in slide-in-from-top duration-150">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <span>
                <strong>Revision Conflict (409):</strong> This file was modified elsewhere on Google Drive since you opened it.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReload}
                className="px-3 py-1.5 rounded-lg bg-surface-900 hover:bg-surface-800 text-slate-200 border border-slate-700 flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reload Remote</span>
              </button>
              <button
                onClick={() => handleSave(true)}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold"
              >
                Overwrite
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 bg-surface-950 overflow-hidden relative">
          {isLoadingContent ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                <span className="text-xs text-slate-400">Loading document...</span>
              </div>
            </div>
          ) : isText ? (
            // Monaco Editor
            <Editor
              height="100%"
              theme="vs-dark"
              language={getMonacoLanguage(node.name)}
              value={textContent}
              onChange={(value) => setTextContent(value || '')}
              options={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                automaticLayout: true,
                padding: { top: 16, bottom: 16 },
              }}
            />
          ) : isImage ? (
            // Image Preview
            <div className="h-full flex items-center justify-center p-6 overflow-auto">
              <img
                src={contentUrl}
                alt={node.name}
                className="max-h-full max-w-full rounded-2xl shadow-glass object-contain"
              />
            </div>
          ) : isPdf ? (
            // PDF Preview
            <iframe
              src={contentUrl}
              title={node.name}
              className="w-full h-full border-none"
            />
          ) : isVideo ? (
            // Video Player
            <div className="h-full flex items-center justify-center p-6 bg-black">
              <video
                controls
                src={contentUrl}
                className="max-h-full max-w-full rounded-2xl shadow-glass"
              />
            </div>
          ) : isAudio ? (
            // Audio Player
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="w-20 h-20 rounded-3xl bg-pink-500/20 text-pink-400 flex items-center justify-center mb-6 shadow-glass">
                <FileText className="w-10 h-10" />
              </div>
              <h4 className="text-lg font-bold text-white mb-4">{node.name}</h4>
              <audio controls src={contentUrl} className="w-full max-w-md" />
            </div>
          ) : isDoc ? (
            // Google Native Doc Preview Hint
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="w-20 h-20 rounded-3xl bg-sky-500/20 text-sky-400 flex items-center justify-center mb-6 shadow-glass">
                <FileText className="w-10 h-10" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">{node.name}</h4>
              <p className="text-xs text-slate-400 max-w-md mb-6">
                This is a native Google App document (Docs/Sheets/Slides). You can open and edit it in Google Drive or export it to standard formats.
              </p>
              <div className="flex items-center gap-3">
                {node.webViewLink && (
                  <a
                    href={node.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary py-2 px-4 text-xs"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open in Google Drive</span>
                  </a>
                )}
                <a
                  href={`/api/nodes/${encodeURIComponent(node.id)}/export?format=pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary py-2 px-4 text-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Export as PDF</span>
                </a>
              </div>
            </div>
          ) : (
            // Unsupported binary preview
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="w-16 h-16 rounded-3xl bg-surface-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-4 shadow-glass">
                <FileText className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-white mb-2">{node.name}</h4>
              <p className="text-xs text-slate-400 max-w-sm mb-6">
                Preview is not available for this file type. You can download it to view locally.
              </p>
              <a
                href={`${contentUrl}?download=1`}
                target="_blank"
                rel="noreferrer"
                className="btn-primary py-2 px-5 text-xs"
              >
                <Download className="w-4 h-4" />
                <span>Download File</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
