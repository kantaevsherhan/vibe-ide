export type FileTreeNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
};

export interface FileNodeDto {
  name: string;
  path: string;
  type: 'file' | 'directory';
  isIgnored: boolean;
  isBinary?: boolean;
  size?: number;
  hasChildren?: boolean;
}

export interface FolderChildrenResponse {
  path: string;
  items: FileNodeDto[];
  limited: boolean;
  total?: number;
  message?: string;
}
