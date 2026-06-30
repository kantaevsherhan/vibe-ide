export type WorkspaceHealthResponse = {
  git: {
    changedFiles: number;
    branch?: string | null;
    clean: boolean;
  };
  terminals: {
    active: number;
  };
  agents: {
    running: number;
    waiting: number;
    errors: number;
  };
};
