type WebMCPAnnotations = {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
};

type WebMCPTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: WebMCPAnnotations;
  execute: (input: Record<string, unknown>) => unknown | Promise<unknown>;
};

interface Document {
  modelContext?: {
    registerTool: (tool: WebMCPTool) => void | Promise<void>;
  };
}

