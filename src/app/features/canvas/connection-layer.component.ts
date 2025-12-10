import { Component, computed, inject } from '@angular/core';
import { MindMapStore } from '../../store/mind-map.store';
import { Position } from '../../core/models/mind-map.model';
import { LAYOUT_CONSTANTS } from '../../core/services/layout.service';

interface Connection {
  id: string;
  path: string;
  color: string;
  hasCustomColor: boolean;
}

type AnchorEdge = 'left' | 'right' | 'top' | 'bottom';

interface AnchorPoints {
  parentAnchor: AnchorEdge;
  childAnchor: AnchorEdge;
}

@Component({
  selector: 'app-connection-layer',
  standalone: true,
  template: `
    <svg class="connections-svg">
      <!-- Arrow marker definition -->
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="var(--connection-color)" />
        </marker>
        <marker
          id="arrowhead-custom"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
        </marker>
      </defs>

      @for (connection of connections(); track connection.id) {
        <path
          [attr.d]="connection.path"
          [attr.stroke]="connection.color"
          [style.color]="connection.color"
          fill="none"
          stroke-width="2"
          stroke-linecap="round"
          [attr.marker-end]="connection.hasCustomColor ? 'url(#arrowhead-custom)' : 'url(#arrowhead)'"
        />
      }
    </svg>
  `,
  styles: `
    :host {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 0;
      overflow: visible;
    }

    .connections-svg {
      position: absolute;
      top: 0;
      left: 0;
      overflow: visible;
      /* Large dimensions to cover the canvas area */
      width: 10000px;
      height: 10000px;
      /* Offset to handle negative coordinates */
      transform: translate(-5000px, -5000px);
    }

    path {
      transition: d 0.15s ease-out;
    }
  `,
})
export class ConnectionLayerComponent {
  private store = inject(MindMapStore);

  // Offset to convert from node coordinates to SVG coordinates
  // Nodes can have negative positions, but SVG paths work better with positive coords
  private readonly SVG_OFFSET = 5000;

  readonly connections = computed(() => {
    const nodes = this.store.nodes();
    const positions = this.store.nodePositions();
    const nodesArray = Object.values(nodes);
    const connections: Connection[] = [];

    nodesArray.forEach((node) => {
      if (node.parentId) {
        const parentPos = positions[node.parentId];
        const childPos = positions[node.id];

        if (parentPos && childPos) {
          const customColor = node.style?.color;
          connections.push({
            id: `${node.parentId}-${node.id}`,
            path: this.createBezierPath(parentPos, childPos),
            color: customColor || 'var(--connection-color)',
            hasCustomColor: !!customColor,
          });
        }
      }
    });

    return connections;
  });

  /**
   * Determine which edges to use for anchoring based on relative positions.
   * Uses the dominant axis (whichever has larger difference).
   */
  private getAnchorEdges(parentPos: Position, childPos: Position): AnchorPoints {
    const nodeWidth = LAYOUT_CONSTANTS.NODE_WIDTH;
    const nodeHeight = LAYOUT_CONSTANTS.NODE_HEIGHT;

    const parentCenterX = parentPos.x + nodeWidth / 2;
    const parentCenterY = parentPos.y + nodeHeight / 2;
    const childCenterX = childPos.x + nodeWidth / 2;
    const childCenterY = childPos.y + nodeHeight / 2;

    const dx = childCenterX - parentCenterX;
    const dy = childCenterY - parentCenterY;

    if (Math.abs(dx) >= Math.abs(dy)) {
      // Horizontal dominant
      return dx >= 0
        ? { parentAnchor: 'right', childAnchor: 'left' }
        : { parentAnchor: 'left', childAnchor: 'right' };
    } else {
      // Vertical dominant
      return dy >= 0
        ? { parentAnchor: 'bottom', childAnchor: 'top' }
        : { parentAnchor: 'top', childAnchor: 'bottom' };
    }
  }

  /**
   * Get the anchor point coordinates for a given edge of a node.
   */
  private getAnchorPoint(pos: Position, edge: AnchorEdge): Position {
    const w = LAYOUT_CONSTANTS.NODE_WIDTH;
    const h = LAYOUT_CONSTANTS.NODE_HEIGHT;

    switch (edge) {
      case 'right':
        return { x: pos.x + w, y: pos.y + h / 2 };
      case 'left':
        return { x: pos.x, y: pos.y + h / 2 };
      case 'top':
        return { x: pos.x + w / 2, y: pos.y };
      case 'bottom':
        return { x: pos.x + w / 2, y: pos.y + h };
    }
  }

  /**
   * Get the control point offset direction for a given anchor edge.
   * Returns a unit vector indicating which direction the control point should extend.
   */
  private getControlDirection(edge: AnchorEdge): { dx: number; dy: number } {
    switch (edge) {
      case 'right':
        return { dx: 1, dy: 0 };
      case 'left':
        return { dx: -1, dy: 0 };
      case 'top':
        return { dx: 0, dy: -1 };
      case 'bottom':
        return { dx: 0, dy: 1 };
    }
  }

  private createBezierPath(parentPos: Position, childPos: Position): string {
    const offset = this.SVG_OFFSET;

    // Determine anchor edges based on relative position
    const { parentAnchor, childAnchor } = this.getAnchorEdges(parentPos, childPos);

    // Get anchor points
    const startPoint = this.getAnchorPoint(parentPos, parentAnchor);
    const endPoint = this.getAnchorPoint(childPos, childAnchor);

    // Apply SVG offset
    const startX = startPoint.x + offset;
    const startY = startPoint.y + offset;
    const endX = endPoint.x + offset;
    const endY = endPoint.y + offset;

    // Calculate control point offset based on distance
    const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    const controlOffset = Math.max(distance * 0.4, 40);

    // Get control point directions
    const startDir = this.getControlDirection(parentAnchor);
    const endDir = this.getControlDirection(childAnchor);

    // Calculate control points
    const cp1X = startX + startDir.dx * controlOffset;
    const cp1Y = startY + startDir.dy * controlOffset;
    const cp2X = endX + endDir.dx * controlOffset;
    const cp2Y = endY + endDir.dy * controlOffset;

    return `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
  }
}
