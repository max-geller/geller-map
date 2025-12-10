import { Injectable } from '@angular/core';
import { MindMapNode, Position } from '../models/mind-map.model';

export interface ComputedLayout {
  [nodeId: string]: Position;
}

// Layout constants
export const LAYOUT_CONSTANTS = {
  NODE_WIDTH: 150,
  NODE_HEIGHT: 48,
  SPACING_X: 250, // Horizontal spacing between parent and children
  SPACING_Y: 70, // Vertical spacing between siblings
};

@Injectable({
  providedIn: 'root',
})
export class LayoutService {
  /**
   * Compute positions for all nodes based on tree structure.
   * Uses a horizontal tree layout:
   * - Root centered at (0, 0) for easy canvas centering
   * - Children positioned to the right
   * - Siblings spaced vertically
   */
  computeLayout(nodes: Record<string, MindMapNode>, rootId: string | undefined): ComputedLayout {
    if (!rootId || !nodes[rootId]) {
      return {};
    }

    const layout: ComputedLayout = {};
    this.layoutNode(nodes, rootId, 0, 0, layout);

    // Offset all positions so the root node's CENTER is at (0, 0)
    // This makes centering on the canvas trivial (panX=0, panY=0)
    const rootPos = layout[rootId];
    if (rootPos) {
      const offsetX = rootPos.x + LAYOUT_CONSTANTS.NODE_WIDTH / 2;
      const offsetY = rootPos.y + LAYOUT_CONSTANTS.NODE_HEIGHT / 2;

      for (const nodeId of Object.keys(layout)) {
        layout[nodeId] = {
          x: layout[nodeId].x - offsetX,
          y: layout[nodeId].y - offsetY,
        };
      }
    }

    return layout;
  }

  /**
   * Recursively layout a node and its children.
   * Returns the total height used by this subtree.
   */
  private layoutNode(
    nodes: Record<string, MindMapNode>,
    nodeId: string,
    depth: number,
    startY: number,
    layout: ComputedLayout
  ): number {
    const node = nodes[nodeId];
    if (!node) return 0;

    const children = node.childrenIds
      .map((id) => nodes[id])
      .filter((n): n is MindMapNode => n !== undefined);

    // Calculate x position based on depth
    const x = depth * LAYOUT_CONSTANTS.SPACING_X;

    if (children.length === 0) {
      // Leaf node - position at startY
      layout[nodeId] = { x, y: startY };
      return LAYOUT_CONSTANTS.NODE_HEIGHT + LAYOUT_CONSTANTS.SPACING_Y;
    }

    // Layout children first to determine subtree height
    let currentY = startY;
    let totalChildHeight = 0;

    for (const child of children) {
      const childHeight = this.layoutNode(nodes, child.id, depth + 1, currentY, layout);
      currentY += childHeight;
      totalChildHeight += childHeight;
    }

    // Position this node vertically centered relative to its children
    const firstChildY = layout[children[0].id]?.y ?? startY;
    const lastChildY = layout[children[children.length - 1].id]?.y ?? startY;
    const centerY = (firstChildY + lastChildY) / 2;

    layout[nodeId] = { x, y: centerY };

    return totalChildHeight;
  }

  /**
   * Get the final position of a node (computed + manual offset)
   */
  getFinalPosition(
    computedPos: Position | undefined,
    manualOffset: Position | undefined
  ): Position {
    if (!computedPos) {
      return { x: 0, y: 0 };
    }

    if (!manualOffset) {
      return computedPos;
    }

    return {
      x: computedPos.x + manualOffset.x,
      y: computedPos.y + manualOffset.y,
    };
  }

  /**
   * Calculate manual offset from a drag operation
   */
  calculateOffset(computedPos: Position, newPos: Position): Position {
    return {
      x: newPos.x - computedPos.x,
      y: newPos.y - computedPos.y,
    };
  }
}
