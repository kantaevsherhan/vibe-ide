export type Project = {
  name: string;
  folderName: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  activeTerminalsCount: number;
};

export type ProjectMetadata = Omit<Project, 'activeTerminalsCount'>;

export type CreateProjectInput = {
  name: string;
  folderName: string;
  description?: string;
};
