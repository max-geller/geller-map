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

  private createBezierPath(parentPos: Position, childPos: Position): string {
    const nodeWidth = LAYOUT_CONSTANTS.NODE_WIDTH;
    const nodeHeight = LAYOUT_CONSTANTS.NODE_HEIGHT;

    // Add offset to handle negative coordinates in SVG
    const offset = this.SVG_OFFSET;

    // Start point: right edge of parent, vertically centered
    const startX = parentPos.x + nodeWidth + offset;
    const startY = parentPos.y + nodeHeight / 2 + offset;

    // End point: left edge of child, vertically centered
    const endX = childPos.x + offset;
    const endY = childPos.y + nodeHeight / 2 + offset;

    // Calculate control points for smooth bezier curve
    const dx = endX - startX;
    const controlOffset = Math.max(Math.abs(dx) * 0.4, 40);

    const cp1X = startX + controlOffset;
    const cp1Y = startY;
    const cp2X = endX - controlOffset;
    const cp2Y = endY;

    return `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
  }
}
