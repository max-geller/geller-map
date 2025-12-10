import { Injectable } from '@angular/core';
import { MindMapNode, Position } from '../models/mind-map.model';
import { LAYOUT_CONSTANTS } from './layout.service';

interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

@Injectable({
  providedIn: 'root',
})
export class PreviewGeneratorService {
  private readonly PREVIEW_WIDTH = 300;
  private readonly PREVIEW_HEIGHT = 200;
  private readonly PADDING = 20;

  /**
   * Generate an SVG preview string from nodes and their positions.
   */
  generatePreview(nodes: MindMapNode[], positions: Record<string, Position>): string {
    if (nodes.length === 0) {
      return this.generateEmptyPreview();
    }

    // Calculate bounding box
    const bbox = this.calculateBoundingBox(nodes, positions);

    // Calculate scale to fit in preview dimensions
    const contentWidth = bbox.maxX - bbox.minX + LAYOUT_CONSTANTS.NODE_WIDTH;
    const contentHeight = bbox.maxY - bbox.minY + LAYOUT_CONSTANTS.NODE_HEIGHT;

    const availableWidth = this.PREVIEW_WIDTH - this.PADDING * 2;
    const availableHeight = this.PREVIEW_HEIGHT - this.PADDING * 2;

    const scaleX = availableWidth / contentWidth;
    const scaleY = availableHeight / contentHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down

    // Calculate offset to center content
    const scaledWidth = contentWidth * scale;
    const scaledHeight = contentHeight * scale;
    const offsetX = (this.PREVIEW_WIDTH - scaledWidth) / 2 - bbox.minX * scale;
    const offsetY = (this.PREVIEW_HEIGHT - scaledHeight) / 2 - bbox.minY * scale;

    // Generate SVG elements
    const connections = this.generateConnections(nodes, positions, scale, offsetX, offsetY);
    const nodeElements = this.generateNodes(nodes, positions, scale, offsetX, offsetY);

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.PREVIEW_WIDTH} ${this.PREVIEW_HEIGHT}" preserveAspectRatio="xMidYMid meet">
  <rect width="100%" height="100%" fill="var(--canvas-bg, #1e1e1e)" rx="8"/>
  ${connections}
  ${nodeElements}
</svg>`;
  }

  private generateEmptyPreview(): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.PREVIEW_WIDTH} ${this.PREVIEW_HEIGHT}" preserveAspectRatio="xMidYMid meet">
  <rect width="100%" height="100%" fill="var(--canvas-bg, #1e1e1e)" rx="8"/>
  <text x="50%" y="50%" text-anchor="middle" fill="var(--node-border, #404040)" font-size="14">Empty Map</text>
</svg>`;
  }

  private calculateBoundingBox(
    nodes: MindMapNode[],
    positions: Record<string, Position>
  ): BoundingBox {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach((node) => {
      const pos = positions[node.id];
      if (pos) {
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x);
        maxY = Math.max(maxY, pos.y);
      }
    });

    return { minX, minY, maxX, maxY };
  }

  private generateConnections(
    nodes: MindMapNode[],
    positions: Record<string, Position>,
    scale: number,
    offsetX: number,
    offsetY: number
  ): string {
    const paths: string[] = [];
    const nodeWidth = LAYOUT_CONSTANTS.NODE_WIDTH * scale;
    const nodeHeight = LAYOUT_CONSTANTS.NODE_HEIGHT * scale;

    nodes.forEach((node) => {
      if (node.parentId) {
        const parentPos = positions[node.parentId];
        const childPos = positions[node.id];

        if (parentPos && childPos) {
          // Determine anchor edges based on relative position
          const { startX, startY, endX, endY } = this.getConnectionPoints(
            parentPos,
            childPos,
            scale,
            offsetX,
            offsetY,
            nodeWidth,
            nodeHeight
          );

          // Simple curved line
          const midX = (startX + endX) / 2;
          const path = `M ${startX} ${startY} Q ${midX} ${startY}, ${midX} ${(startY + endY) / 2} T ${endX} ${endY}`;

          // Use connection-specific color, fall back to node color, then default
          const strokeColor = node.style?.connectionColor || node.style?.color || 'var(--connection-color, #b39ddb)';
          const isDashed = node.style?.connectionDashed ?? false;
          const dashArray = isDashed ? 'stroke-dasharray="4 2"' : '';

          paths.push(
            `<path d="${path}" stroke="${strokeColor}" stroke-width="1.5" fill="none" opacity="0.8" ${dashArray}/>`
          );
        }
      }
    });

    return paths.join('\n  ');
  }

  private getConnectionPoints(
    parentPos: Position,
    childPos: Position,
    scale: number,
    offsetX: number,
    offsetY: number,
    nodeWidth: number,
    nodeHeight: number
  ): { startX: number; startY: number; endX: number; endY: number } {
    const parentCenterX = parentPos.x * scale + offsetX + nodeWidth / 2;
    const parentCenterY = parentPos.y * scale + offsetY + nodeHeight / 2;
    const childCenterX = childPos.x * scale + offsetX + nodeWidth / 2;
    const childCenterY = childPos.y * scale + offsetY + nodeHeight / 2;

    const dx = childCenterX - parentCenterX;
    const dy = childCenterY - parentCenterY;

    let startX: number, startY: number, endX: number, endY: number;

    if (Math.abs(dx) >= Math.abs(dy)) {
      // Horizontal dominant
      if (dx >= 0) {
        startX = parentPos.x * scale + offsetX + nodeWidth;
        endX = childPos.x * scale + offsetX;
      } else {
        startX = parentPos.x * scale + offsetX;
        endX = childPos.x * scale + offsetX + nodeWidth;
      }
      startY = parentPos.y * scale + offsetY + nodeHeight / 2;
      endY = childPos.y * scale + offsetY + nodeHeight / 2;
    } else {
      // Vertical dominant
      if (dy >= 0) {
        startY = parentPos.y * scale + offsetY + nodeHeight;
        endY = childPos.y * scale + offsetY;
      } else {
        startY = parentPos.y * scale + offsetY;
        endY = childPos.y * scale + offsetY + nodeHeight;
      }
      startX = parentPos.x * scale + offsetX + nodeWidth / 2;
      endX = childPos.x * scale + offsetX + nodeWidth / 2;
    }

    return { startX, startY, endX, endY };
  }

  private generateNodes(
    nodes: MindMapNode[],
    positions: Record<string, Position>,
    scale: number,
    offsetX: number,
    offsetY: number
  ): string {
    const elements: string[] = [];
    const nodeWidth = LAYOUT_CONSTANTS.NODE_WIDTH * scale;
    const nodeHeight = LAYOUT_CONSTANTS.NODE_HEIGHT * scale;

    nodes.forEach((node) => {
      const pos = positions[node.id];
      if (!pos) return;

      const x = pos.x * scale + offsetX;
      const y = pos.y * scale + offsetY;
      const isRoot = !node.parentId;
      const fillColor = node.style?.color || 'var(--node-bg, #2d2d2d)';
      const strokeColor = isRoot ? 'var(--selection-color, #b388ff)' : 'var(--node-border, #404040)';
      const strokeWidth = isRoot ? 2 : 1;

      elements.push(
        `<rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="4" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`
      );
    });

    return elements.join('\n  ');
  }
}
