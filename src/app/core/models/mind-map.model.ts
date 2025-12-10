export interface Position {
  x: number;
  y: number;
}

export interface MindMap {
  id: string;
  userId: string;
  name: string;
  description?: string;
  rootNodeId: string;
  settings: MindMapSettings;
  previewSvg?: string; // Cached SVG string for dashboard preview
  createdAt: Date;
  updatedAt: Date;
}

export interface MindMapSettings {
  theme: 'light' | 'dark' | 'system';
  layoutMode: 'freeform' | 'auto';
  defaultNodeColor?: string;
}

export interface MindMapNode {
  id: string;
  userId: string;
  mapId: string;
  parentId: string | null;
  text: string;
  // Manual offset from auto-computed position (set when user drags a node)
  manualOffset?: Position;
  // Legacy position field (kept for backward compatibility, not used in new layout)
  position?: Position;
  style?: NodeStyle;
  task?: NodeTask;
  attachments?: NodeAttachment[];
  isExpanded: boolean;
  childrenIds: string[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NodeStyle {
  color?: string;
  shape?: 'rounded' | 'square' | 'circle';
  fontFamily?: string;
  icon?: string;
}

export interface NodeTask {
  dueDate?: Date;
  priority?: 'low' | 'medium' | 'high';
  isComplete?: boolean;
}

export interface NodeAttachment {
  type: 'image' | 'link' | 'file';
  url: string;
  name?: string;
}

// Action types for undo/redo
export type MindMapAction =
  | { type: 'ADD_NODE'; node: MindMapNode }
  | { type: 'DELETE_NODE'; node: MindMapNode; parentId: string | null }
  | {
      type: 'SET_OFFSET';
      nodeId: string;
      from: Position | undefined;
      to: Position | undefined;
      // For group moves, stores all affected node offsets
      descendantOffsets?: {
        old: Record<string, Position | undefined>;
        new: Record<string, Position>;
      };
    }
  | { type: 'UPDATE_NODE'; nodeId: string; before: Partial<MindMapNode>; after: Partial<MindMapNode> }
  | { type: 'REPARENT_NODE'; nodeId: string; fromParentId: string | null; toParentId: string | null };

export interface ViewTransform {
  scale: number;
  panX: number;
  panY: number;
}

export interface MindMapState {
  currentMap: MindMap | null;
  nodes: Record<string, MindMapNode>;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  history: {
    past: MindMapAction[];
    future: MindMapAction[];
  };
  view: ViewTransform;
}
