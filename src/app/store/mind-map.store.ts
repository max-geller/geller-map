import { Injectable, computed, inject, signal } from '@angular/core';
import {
  MindMap,
  MindMapNode,
  MindMapState,
  MindMapAction,
  ViewTransform,
  Position,
} from '../core/models/mind-map.model';
import { LayoutService, ComputedLayout, LAYOUT_CONSTANTS } from '../core/services/layout.service';

const DEFAULT_VIEW: ViewTransform = {
  scale: 1,
  panX: 0,
  panY: 0,
};

const INITIAL_STATE: MindMapState = {
  currentMap: null,
  nodes: {},
  selectedNodeId: null,
  editingNodeId: null,
  history: {
    past: [],
    future: [],
  },
  view: DEFAULT_VIEW,
};

@Injectable({
  providedIn: 'root',
})
export class MindMapStore {
  private layoutService = inject(LayoutService);

  // Private state signals
  private _state = signal<MindMapState>(INITIAL_STATE);

  // Dirty tracking - tracks which nodes have been modified since last save
  private _dirtyNodeIds = signal<Set<string>>(new Set());
  private _deletedNodeIds = signal<Set<string>>(new Set());
  private _mapDirty = signal(false);

  // Drag state for live connection updates during node dragging
  private _draggingState = signal<{
    nodeId: string;
    delta: Position;
    descendantIds: string[]; // All descendants of the dragged node
  } | null>(null);
  readonly draggingState = this._draggingState.asReadonly();

  // Public readonly signals
  readonly state = this._state.asReadonly();
  readonly currentMap = computed(() => this._state().currentMap);
  readonly nodes = computed(() => this._state().nodes);
  readonly selectedNodeId = computed(() => this._state().selectedNodeId);
  readonly editingNodeId = computed(() => this._state().editingNodeId);
  readonly view = computed(() => this._state().view);
  readonly history = computed(() => this._state().history);

  // Dirty state signals (public for auto-save service)
  readonly dirtyNodeIds = this._dirtyNodeIds.asReadonly();
  readonly deletedNodeIds = this._deletedNodeIds.asReadonly();
  readonly mapDirty = this._mapDirty.asReadonly();
  readonly hasPendingChanges = computed(() => 
    this._dirtyNodeIds().size > 0 || this._deletedNodeIds().size > 0 || this._mapDirty()
  );

  // Derived signals
  readonly nodesArray = computed(() => Object.values(this._state().nodes));
  readonly rootNode = computed(() => {
    const map = this._state().currentMap;
    if (!map) return null;
    return this._state().nodes[map.rootNodeId] || null;
  });
  readonly selectedNode = computed(() => {
    const id = this._state().selectedNodeId;
    return id ? this._state().nodes[id] || null : null;
  });
  readonly canUndo = computed(() => this._state().history.past.length > 0);
  readonly canRedo = computed(() => this._state().history.future.length > 0);

  // =========== Layout Computed Signals ===========

  /**
   * Computed layout based on tree structure
   */
  readonly computedLayout = computed<ComputedLayout>(() => {
    const nodes = this._state().nodes;
    const rootId = this._state().currentMap?.rootNodeId;
    return this.layoutService.computeLayout(nodes, rootId);
  });

  /**
   * Final node positions (computed + manual offset)
   */
  readonly nodePositions = computed<Record<string, Position>>(() => {
    const layout = this.computedLayout();
    const nodes = this._state().nodes;
    const positions: Record<string, Position> = {};

    for (const [nodeId, node] of Object.entries(nodes)) {
      const computedPos = layout[nodeId];
      positions[nodeId] = this.layoutService.getFinalPosition(computedPos, node.manualOffset);
    }

    return positions;
  });

  /**
   * Get position for a specific node
   */
  getNodePosition(nodeId: string): Position {
    return this.nodePositions()[nodeId] || { x: 0, y: 0 };
  }

  // Get children of a node
  getChildNodes(nodeId: string) {
    return computed(() => {
      const node = this._state().nodes[nodeId];
      if (!node) return [];
      return node.childrenIds
        .map((id) => this._state().nodes[id])
        .filter((n): n is MindMapNode => n !== undefined);
    });
  }

  // =========== State Mutations ===========

  /**
   * Load a mind map and its nodes
   */
  loadMap(map: MindMap, nodes: MindMapNode[]): void {
    const nodesMap: Record<string, MindMapNode> = {};
    nodes.forEach((node) => {
      nodesMap[node.id] = node;
    });

    this._state.update((state) => ({
      ...state,
      currentMap: map,
      nodes: nodesMap,
      selectedNodeId: null,
      editingNodeId: null,
      history: { past: [], future: [] },
      view: DEFAULT_VIEW,
    }));

    // Clear dirty state on load
    this.clearDirtyState();
  }

  /**
   * Clear the current map
   */
  clearMap(): void {
    this._state.set(INITIAL_STATE);
    this.clearDirtyState();
  }

  // =========== Dirty State Management ===========

  /**
   * Mark a node as dirty (modified)
   */
  private markNodeDirty(nodeId: string): void {
    this._dirtyNodeIds.update((set) => new Set(set).add(nodeId));
  }

  /**
   * Mark multiple nodes as dirty
   */
  private markNodesDirty(nodeIds: string[]): void {
    this._dirtyNodeIds.update((set) => {
      const newSet = new Set(set);
      nodeIds.forEach((id) => newSet.add(id));
      return newSet;
    });
  }

  /**
   * Mark a node as deleted
   */
  private markNodeDeleted(nodeId: string): void {
    this._deletedNodeIds.update((set) => new Set(set).add(nodeId));
    // Remove from dirty if it was there
    this._dirtyNodeIds.update((set) => {
      const newSet = new Set(set);
      newSet.delete(nodeId);
      return newSet;
    });
  }

  /**
   * Mark the map itself as dirty (for preview updates)
   */
  markMapDirty(): void {
    this._mapDirty.set(true);
  }

  /**
   * Clear all dirty state after a successful save
   */
  clearDirtyState(): void {
    this._dirtyNodeIds.set(new Set());
    this._deletedNodeIds.set(new Set());
    this._mapDirty.set(false);
  }

  /**
   * Get the nodes that need to be saved
   */
  getDirtyNodes(): MindMapNode[] {
    const nodes = this._state().nodes;
    return Array.from(this._dirtyNodeIds()).map((id) => nodes[id]).filter(Boolean);
  }

  /**
   * Get the IDs of deleted nodes
   */
  getDeletedNodeIds(): string[] {
    return Array.from(this._deletedNodeIds());
  }

  // =========== Drag State Management ===========

  /**
   * Set the dragging state for live connection updates
   */
  setDraggingState(state: { nodeId: string; delta: Position; descendantIds: string[] } | null): void {
    this._draggingState.set(state);
  }

  /**
   * Select a node
   */
  selectNode(nodeId: string | null): void {
    this._state.update((state) => ({
      ...state,
      selectedNodeId: nodeId,
      editingNodeId: null,
    }));
  }

  /**
   * Start editing a node
   */
  startEditing(nodeId: string): void {
    this._state.update((state) => ({
      ...state,
      selectedNodeId: nodeId,
      editingNodeId: nodeId,
    }));
  }

  /**
   * Stop editing
   */
  stopEditing(): void {
    this._state.update((state) => ({
      ...state,
      editingNodeId: null,
    }));
  }

  /**
   * Add a node
   */
  addNode(node: MindMapNode, skipHistory = false): void {
    this._state.update((state) => {
      const newNodes = { ...state.nodes, [node.id]: node };

      // Update parent's childrenIds
      if (node.parentId && state.nodes[node.parentId]) {
        const parent = state.nodes[node.parentId];
        newNodes[node.parentId] = {
          ...parent,
          childrenIds: [...parent.childrenIds, node.id],
        };
      }

      const newHistory = skipHistory
        ? state.history
        : {
            past: [...state.history.past, { type: 'ADD_NODE' as const, node }],
            future: [],
          };

      return {
        ...state,
        nodes: newNodes,
        history: newHistory,
        selectedNodeId: node.id,
      };
    });

    // Mark as dirty for auto-save
    this.markNodeDirty(node.id);
    if (node.parentId) {
      this.markNodeDirty(node.parentId); // Parent's childrenIds changed
    }
    this.markMapDirty(); // Preview needs update
  }

  /**
   * Delete a node and its children
   */
  deleteNode(nodeId: string, skipHistory = false): void {
    const node = this._state().nodes[nodeId];
    if (!node || !node.parentId) return; // Cannot delete root node

    const nodesToDelete = this.getDescendantIds(nodeId, this._state().nodes);
    nodesToDelete.push(nodeId);
    const parentId = node.parentId;

    this._state.update((state) => {
      const newNodes = { ...state.nodes };

      // Remove from parent's childrenIds
      if (parentId && newNodes[parentId]) {
        const parent = newNodes[parentId];
        newNodes[parentId] = {
          ...parent,
          childrenIds: parent.childrenIds.filter((id) => id !== nodeId),
        };
      }

      // Delete all nodes
      nodesToDelete.forEach((id) => delete newNodes[id]);

      const newHistory = skipHistory
        ? state.history
        : {
            past: [
              ...state.history.past,
              { type: 'DELETE_NODE' as const, node, parentId: node.parentId },
            ],
            future: [],
          };

      return {
        ...state,
        nodes: newNodes,
        history: newHistory,
        selectedNodeId: parentId,
      };
    });

    // Mark as dirty for auto-save
    nodesToDelete.forEach((id) => this.markNodeDeleted(id));
    if (parentId) {
      this.markNodeDirty(parentId); // Parent's childrenIds changed
    }
    this.markMapDirty(); // Preview needs update
  }

  /**
   * Update a node
   */
  updateNode(nodeId: string, updates: Partial<MindMapNode>, skipHistory = false): void {
    const node = this._state().nodes[nodeId];
    if (!node) return;

    this._state.update((state) => {
      const updatedNode = { ...node, ...updates, updatedAt: new Date() };

      const newHistory = skipHistory
        ? state.history
        : {
            past: [
              ...state.history.past,
              {
                type: 'UPDATE_NODE' as const,
                nodeId,
                before: node,
                after: updates,
              },
            ],
            future: [],
          };

      return {
        ...state,
        nodes: { ...state.nodes, [nodeId]: updatedNode },
        history: newHistory,
      };
    });

    // Mark as dirty for auto-save
    this.markNodeDirty(nodeId);
    // If text changed, update preview
    if (updates.text !== undefined) {
      this.markMapDirty();
    }
  }

  /**
   * Update connection style for a node's incoming connection (from parent)
   */
  updateConnectionStyle(
    nodeId: string,
    style: { connectionColor?: string; connectionDashed?: boolean }
  ): void {
    const node = this._state().nodes[nodeId];
    if (!node) return;

    const currentStyle = node.style || {};
    const newStyle = { ...currentStyle };

    // Update or remove connectionColor
    if (style.connectionColor !== undefined) {
      if (style.connectionColor === undefined || style.connectionColor === null) {
        delete newStyle.connectionColor;
      } else {
        newStyle.connectionColor = style.connectionColor;
      }
    }

    // Update connectionDashed
    if (style.connectionDashed !== undefined) {
      if (style.connectionDashed === false) {
        delete newStyle.connectionDashed;
      } else {
        newStyle.connectionDashed = style.connectionDashed;
      }
    }

    this.updateNode(nodeId, { style: newStyle });
    this.markMapDirty(); // Preview needs update for connection colors
  }

  /**
   * Set manual offset for a node (when user drags it)
   * Also moves all descendant nodes by the same delta to maintain relationships
   */
  setNodeOffset(nodeId: string, newPosition: Position, skipHistory = false): void {
    const node = this._state().nodes[nodeId];
    if (!node) return;

    const computedPos = this.computedLayout()[nodeId];
    const currentFinalPos = this.nodePositions()[nodeId];
    
    // Calculate delta from current position to new position
    const delta = {
      x: newPosition.x - currentFinalPos.x,
      y: newPosition.y - currentFinalPos.y,
    };

    // Get all descendant IDs
    const descendantIds = this.getDescendantIds(nodeId, this._state().nodes);

    this._state.update((state) => {
      const newNodes = { ...state.nodes };
      const oldOffsets: Record<string, Position | undefined> = {};
      const newOffsets: Record<string, Position> = {};

      // Update the dragged node
      const currentNode = state.nodes[nodeId];
      oldOffsets[nodeId] = currentNode.manualOffset;
      const newOffset = this.layoutService.calculateOffset(
        computedPos || { x: 0, y: 0 },
        newPosition
      );
      newOffsets[nodeId] = newOffset;
      newNodes[nodeId] = { ...currentNode, manualOffset: newOffset, updatedAt: new Date() };

      // Update all descendants - apply same delta
      for (const descId of descendantIds) {
        const descNode = state.nodes[descId];
        if (!descNode) continue;

        oldOffsets[descId] = descNode.manualOffset;
        const descCurrentOffset = descNode.manualOffset || { x: 0, y: 0 };
        const descNewOffset = {
          x: descCurrentOffset.x + delta.x,
          y: descCurrentOffset.y + delta.y,
        };
        newOffsets[descId] = descNewOffset;
        newNodes[descId] = { ...descNode, manualOffset: descNewOffset, updatedAt: new Date() };
      }

      const newHistory = skipHistory
        ? state.history
        : {
            past: [
              ...state.history.past,
              {
                type: 'SET_OFFSET' as const,
                nodeId,
                from: oldOffsets[nodeId],
                to: newOffsets[nodeId],
                // Store descendant offsets for proper undo
                descendantOffsets: descendantIds.length > 0 ? { old: oldOffsets, new: newOffsets } : undefined,
              },
            ],
            future: [],
          };

      return {
        ...state,
        nodes: newNodes, // Use the newNodes object that includes ALL updated nodes
        history: newHistory,
      };
    });

    // Mark as dirty for auto-save
    this.markNodeDirty(nodeId);
    if (descendantIds.length > 0) {
      this.markNodesDirty(descendantIds);
    }
    this.markMapDirty(); // Preview needs update
  }

  /**
   * Clear manual offset (reset to auto position)
   */
  clearNodeOffset(nodeId: string): void {
    const node = this._state().nodes[nodeId];
    if (!node) return;

    this._state.update((state) => {
      const currentNode = state.nodes[nodeId];
      const { manualOffset, ...nodeWithoutOffset } = currentNode;

      return {
        ...state,
        nodes: {
          ...state.nodes,
          [nodeId]: { ...nodeWithoutOffset, updatedAt: new Date() } as MindMapNode,
        },
      };
    });
  }

  // =========== View Controls ===========

  /**
   * Update the view transform
   */
  updateView(transform: Partial<ViewTransform>): void {
    this._state.update((state) => ({
      ...state,
      view: { ...state.view, ...transform },
    }));
  }

  /**
   * Reset the view to default
   */
  resetView(): void {
    this._state.update((state) => ({
      ...state,
      view: DEFAULT_VIEW,
    }));
  }

  /**
   * Zoom in
   */
  zoomIn(): void {
    this._state.update((state) => ({
      ...state,
      view: { ...state.view, scale: Math.min(state.view.scale * 1.2, 3) },
    }));
  }

  /**
   * Zoom out
   */
  zoomOut(): void {
    this._state.update((state) => ({
      ...state,
      view: { ...state.view, scale: Math.max(state.view.scale / 1.2, 0.3) },
    }));
  }

  // =========== History (Undo/Redo) ===========

  /**
   * Undo the last action
   */
  undo(): void {
    const { past, future } = this._state().history;
    if (past.length === 0) return;

    const lastAction = past[past.length - 1];
    this.revertAction(lastAction);

    this._state.update((state) => ({
      ...state,
      history: {
        past: past.slice(0, -1),
        future: [lastAction, ...future],
      },
    }));
  }

  /**
   * Redo the last undone action
   */
  redo(): void {
    const { past, future } = this._state().history;
    if (future.length === 0) return;

    const nextAction = future[0];
    this.applyAction(nextAction);

    this._state.update((state) => ({
      ...state,
      history: {
        past: [...past, nextAction],
        future: future.slice(1),
      },
    }));
  }

  // =========== Helper Methods ===========

  private getDescendantIds(nodeId: string, nodes: Record<string, MindMapNode>): string[] {
    const node = nodes[nodeId];
    if (!node) return [];

    const descendants: string[] = [];
    node.childrenIds.forEach((childId) => {
      descendants.push(childId);
      descendants.push(...this.getDescendantIds(childId, nodes));
    });
    return descendants;
  }

  /**
   * Public method to get all descendant IDs of a node
   */
  getDescendantIdsPublic(nodeId: string): string[] {
    return this.getDescendantIds(nodeId, this._state().nodes);
  }

  private revertAction(action: MindMapAction): void {
    switch (action.type) {
      case 'ADD_NODE':
        this.deleteNode(action.node.id, true);
        break;
      case 'DELETE_NODE':
        this.addNode(action.node, true);
        break;
      case 'SET_OFFSET':
        // Restore old offsets for the node and all descendants
        if (action.descendantOffsets) {
          this.setOffsetsMultiple(action.descendantOffsets.old);
        } else {
          this.setOffsetDirect(action.nodeId, action.from);
        }
        break;
      case 'UPDATE_NODE':
        this.updateNode(action.nodeId, action.before as Partial<MindMapNode>, true);
        break;
    }
  }

  private applyAction(action: MindMapAction): void {
    switch (action.type) {
      case 'ADD_NODE':
        this.addNode(action.node, true);
        break;
      case 'DELETE_NODE':
        this.deleteNode(action.node.id, true);
        break;
      case 'SET_OFFSET':
        // Apply new offsets for the node and all descendants
        if (action.descendantOffsets) {
          this.setOffsetsMultiple(action.descendantOffsets.new);
        } else {
          this.setOffsetDirect(action.nodeId, action.to);
        }
        break;
      case 'UPDATE_NODE':
        this.updateNode(action.nodeId, action.after as Partial<MindMapNode>, true);
        break;
    }
  }

  /**
   * Directly set offset without computing from position (for undo/redo)
   */
  private setOffsetDirect(nodeId: string, offset: Position | undefined): void {
    this._state.update((state) => {
      const node = state.nodes[nodeId];
      if (!node) return state;

      return {
        ...state,
        nodes: {
          ...state.nodes,
          [nodeId]: { ...node, manualOffset: offset },
        },
      };
    });
  }

  /**
   * Set offsets for multiple nodes at once (for undo/redo of group moves)
   */
  private setOffsetsMultiple(offsets: Record<string, Position | undefined>): void {
    this._state.update((state) => {
      const newNodes = { ...state.nodes };

      for (const [nodeId, offset] of Object.entries(offsets)) {
        const node = newNodes[nodeId];
        if (node) {
          newNodes[nodeId] = { ...node, manualOffset: offset };
        }
      }

      return {
        ...state,
        nodes: newNodes,
      };
    });
  }

  /**
   * Generate a unique ID
   */
  generateId(prefix = 'node'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
