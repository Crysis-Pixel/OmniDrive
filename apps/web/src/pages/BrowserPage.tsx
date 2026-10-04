import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/endpoints';
import { Topbar } from '../components/layout/Topbar';
import { FileBrowser } from '../components/browser/FileBrowser';
import { FileNodeDTO } from '@omnidrive/shared';

export const BrowserPage: React.FC = () => {
  const { folderId } = useParams<{ folderId?: string }>();
  const navigate = useNavigate();
  const currentParentId = folderId ? decodeURIComponent(folderId) : 'root';

  const { data, isLoading } = useQuery({
    queryKey: ['nodes', currentParentId],
    queryFn: () => api.nodes.list({ parent: currentParentId }),
    refetchInterval: 15000,
  });

  const handleOpenFolder = (node: FileNodeDTO) => {
    navigate(`/folder/${encodeURIComponent(node.id)}`);
  };

  const handleNavigateBreadcrumb = (id: string) => {
    if (id === 'root') {
      navigate('/');
    } else {
      navigate(`/folder/${encodeURIComponent(id)}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <Topbar
        breadcrumbs={data?.breadcrumbs || []}
        onNavigateBreadcrumb={handleNavigateBreadcrumb}
        currentParentId={currentParentId}
      />
      <FileBrowser
        data={data}
        isLoading={isLoading}
        onOpenFolder={handleOpenFolder}
        currentParentId={currentParentId}
      />
    </div>
  );
};
