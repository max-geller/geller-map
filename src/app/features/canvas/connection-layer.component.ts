import { Component, computed, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MindMapStore } from '../../store/mind-map.store';
import { Position } from '../../core/models/mind-map.model';
import { LAYOUT_CONSTANTS } from '../../core/services/layout.service';

interface Connection {
  id: string;
  nodeId: string; // The child node ID (owns the connection style)
  path: string;
  color: string;
  hasCustomColor: boolean;
  dashed: boolean;
  midpoint: Position;
}

type AnchorEdge = 'left' | 'right' | 'top' | 'bottom';

interface AnchorPoints {
  parentAnchor: AnchorEdge;
  childAnchor: AnchorEdge;
}

// Preset colors for the color palette
const COLOR_PALETTE = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
];

@Component({
  selector: 'app-connection-layer',
  standalone: true,
  imports: [MatMenuModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <svg class="connections-svg">
      <!-- Arrow marker definitions -->
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
        <!-- Hit area (invisible, wider for easier hover) -->
        <path
          [attr.d]="connection.path"
          stroke="transparent"
          stroke-width="20"
          fill="none"
          class="hit-area"
          (mouseenter)="onConnectionHover(connection)"
          (mouseleave)="onConnectionLeave()"
        />

        <!-- Visible connection line -->
        <path
          [attr.d]="connection.path"
          [attr.stroke]="connection.color"
          [style.color]="connection.color"
          fill="none"
          stroke-width="2"
          stroke-linecap="round"
          [attr.stroke-dasharray]="connection.dashed ? '8 4' : 'none'"
          [attr.marker-end]="connection.hasCustomColor ? 'url(#arrowhead-custom)' : 'url(#arrowhead)'"
        />
      }

      <!-- Midpoint button (appears on hover) -->
      @if (hoveredConnection()) {
        <g
          class="midpoint-button"
          [attr.transform]="'translate(' + hoveredConnection()!.midpoint.x + ',' + hoveredConnection()!.midpoint.y + ')'"
          (mouseenter)="keepHovered()"
          (mouseleave)="onConnectionLeave()"
        >
          <circle r="14" class="midpoint-bg" />
          <circle r="12" class="midpoint-circle" (click)="openStyleMenu($event)" />
          <text y="1" text-anchor="middle" dominant-baseline="middle" class="midpoint-icon">⚙</text>
        </g>
      }
    </svg>

    <!-- Style menu (positioned via CDK overlay) -->
    <div
      class="menu-trigger"
      [style.left.px]="menuPosition().x"
      [style.top.px]="menuPosition().y"
      [matMenuTriggerFor]="styleMenu"
      #menuTrigger="matMenuTrigger"
    ></div>

    <mat-menu #styleMenu="matMenu" class="connection-style-menu">
      <div class="style-menu-content" (click)="$event.stopPropagation()">
        <div class="menu-section">
          <span class="section-label">Line Color</span>
          <div class="color-palette">
            @for (color of colorPalette; track color) {
              <button
                class="color-swatch"
                [style.background-color]="color"
                [class.selected]="selectedConnection()?.color === color"
                (click)="setConnectionColor(color)"
                [matTooltip]="color"
              ></button>
            }
            <button
              class="color-swatch reset"
              (click)="resetConnectionColor()"
              matTooltip="Reset to default"
            >
              <mat-icon>format_color_reset</mat-icon>
            </button>
          </div>
        </div>

        <div class="menu-section">
          <span class="section-label">Line Style</span>
          <div class="style-buttons">
            <button
              mat-stroked-button
              [class.selected]="!selectedConnection()?.dashed"
              (click)="setConnectionDashed(false)"
            >
              <svg width="40" height="4" viewBox="0 0 40 4">
                <line x1="0" y1="2" x2="40" y2="2" stroke="currentColor" stroke-width="2" />
              </svg>
              <span>Solid</span>
            </button>
            <button
              mat-stroked-button
              [class.selected]="selectedConnection()?.dashed"
              (click)="setConnectionDashed(true)"
            >
              <svg width="40" height="4" viewBox="0 0 40 4">
                <line x1="0" y1="2" x2="40" y2="2" stroke="currentColor" stroke-width="2" stroke-dasharray="6 3" />
              </svg>
              <span>Dashed</span>
            </button>
          </div>
        </div>
      </div>
    </mat-menu>
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
      width: 10000px;
      height: 10000px;
      transform: translate(-5000px, -5000px);
    }

    path {
      transition: d 0.15s ease-out;
    }

    .hit-area {
      pointer-events: stroke;
      cursor: pointer;
    }

    .midpoint-button {
      pointer-events: all;
      cursor: pointer;
    }

    .midpoint-bg {
      fill: var(--node-bg);
      stroke: var(--node-border);
      stroke-width: 1;
    }

    .midpoint-circle {
      fill: var(--node-bg);
      stroke: var(--selection-color);
      stroke-width: 2;
      transition: all 0.15s ease;
    }

    .midpoint-circle:hover {
      fill: var(--selection-color);
      transform: scale(1.1);
    }

    .midpoint-icon {
      font-size: 12px;
      fill: var(--connection-color);
      pointer-events: none;
    }

    .midpoint-circle:hover + .midpoint-icon {
      fill: white;
    }

    .menu-trigger {
      position: fixed;
      width: 0;
      height: 0;
      pointer-events: none;
    }

    /* Style menu styles */
    :host ::ng-deep .connection-style-menu {
      .mat-mdc-menu-content {
        padding: 0;
      }
    }

    .style-menu-content {
      padding: 12px;
      min-width: 200px;
    }

    .menu-section {
      margin-bottom: 12px;

      &:last-child {
        margin-bottom: 0;
      }
    }

    .section-label {
      display: block;
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      color: var(--connection-color);
      margin-bottom: 8px;
      opacity: 0.7;
    }

    .color-palette {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .color-swatch {
      width: 28px;
      height: 28px;
      border-radius: 4px;
      border: 2px solid transparent;
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover {
        transform: scale(1.1);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }

      &.selected {
        border-color: var(--selection-color);
        box-shadow: 0 0 0 2px var(--selection-color);
      }

      &.reset {
        background: var(--node-bg);
        border: 1px dashed var(--node-border);

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }
      }
    }

    .style-buttons {
      display: flex;
      gap: 8px;

      button {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 8px;
        min-height: 56px;

        &.selected {
          border-color: var(--selection-color);
          background: rgba(var(--selection-color-rgb, 33, 150, 243), 0.1);
        }

        svg {
          flex-shrink: 0;
        }

        span {
          font-size: 11px;
        }
      }
    }
  `,
})
export class ConnectionLayerComponent {
  @ViewChild('menuTrigger') menuTrigger!: MatMenuTrigger;

  private store = inject(MindMapStore);

  readonly colorPalette = COLOR_PALETTE;

  // Offset to convert from node coordinates to SVG coordinates
  private readonly SVG_OFFSET = 5000;

  // Hover state
  hoveredConnection = signal<Connection | null>(null);
  selectedConnection = signal<Connection | null>(null);
  menuPosition = signal<Position>({ x: 0, y: 0 });

  private hoverTimeout: ReturnType<typeof setTimeout> | null = null;

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
          // Use connectionColor if set, otherwise fall back to node color
          const customColor = node.style?.connectionColor || node.style?.color;
          const dashed = node.style?.connectionDashed ?? false;

          const pathData = this.createBezierPathData(parentPos, childPos);

          connections.push({
            id: `${node.parentId}-${node.id}`,
            nodeId: node.id,
            path: pathData.path,
            color: customColor || 'var(--connection-color)',
            hasCustomColor: !!customColor,
            dashed,
            midpoint: pathData.midpoint,
          });
        }
      }
    });

    return connections;
  });

  onConnectionHover(connection: Connection): void {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
    this.hoveredConnection.set(connection);
  }

  onConnectionLeave(): void {
    // Small delay before hiding to allow moving to the button
    this.hoverTimeout = setTimeout(() => {
      this.hoveredConnection.set(null);
    }, 150);
  }

  keepHovered(): void {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
  }

  openStyleMenu(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();

    const connection = this.hoveredConnection();
    if (!connection) return;

    this.selectedConnection.set(connection);

    // Position the menu near the click
    this.menuPosition.set({ x: event.clientX, y: event.clientY });

    // Open the menu after a tick to ensure position is set
    setTimeout(() => {
      this.menuTrigger.openMenu();
    }, 0);
  }

  setConnectionColor(color: string): void {
    const connection = this.selectedConnection();
    if (!connection) return;

    this.store.updateConnectionStyle(connection.nodeId, { connectionColor: color });
  }

  resetConnectionColor(): void {
    const connection = this.selectedConnection();
    if (!connection) return;

    this.store.updateConnectionStyle(connection.nodeId, { connectionColor: undefined });
  }

  setConnectionDashed(dashed: boolean): void {
    const connection = this.selectedConnection();
    if (!connection) return;

    this.store.updateConnectionStyle(connection.nodeId, { connectionDashed: dashed });
  }

  // =========== Layout & Path Calculation ===========

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
      return dx >= 0
        ? { parentAnchor: 'right', childAnchor: 'left' }
        : { parentAnchor: 'left', childAnchor: 'right' };
    } else {
      return dy >= 0
        ? { parentAnchor: 'bottom', childAnchor: 'top' }
        : { parentAnchor: 'top', childAnchor: 'bottom' };
    }
  }

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

  /**
   * Calculate the midpoint of a cubic Bezier curve using De Casteljau's algorithm at t=0.5
   */
  private getBezierMidpoint(
    p0: Position,
    p1: Position,
    p2: Position,
    p3: Position
  ): Position {
    const t = 0.5;

    // Level 1
    const l1p0 = this.lerp(p0, p1, t);
    const l1p1 = this.lerp(p1, p2, t);
    const l1p2 = this.lerp(p2, p3, t);

    // Level 2
    const l2p0 = this.lerp(l1p0, l1p1, t);
    const l2p1 = this.lerp(l1p1, l1p2, t);

    // Level 3 (midpoint)
    return this.lerp(l2p0, l2p1, t);
  }

  private lerp(a: Position, b: Position, t: number): Position {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    };
  }

  private createBezierPathData(
    parentPos: Position,
    childPos: Position
  ): { path: string; midpoint: Position } {
    const offset = this.SVG_OFFSET;

    const { parentAnchor, childAnchor } = this.getAnchorEdges(parentPos, childPos);

    const startPoint = this.getAnchorPoint(parentPos, parentAnchor);
    const endPoint = this.getAnchorPoint(childPos, childAnchor);

    const startX = startPoint.x + offset;
    const startY = startPoint.y + offset;
    const endX = endPoint.x + offset;
    const endY = endPoint.y + offset;

    const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    const controlOffset = Math.max(distance * 0.4, 40);

    const startDir = this.getControlDirection(parentAnchor);
    const endDir = this.getControlDirection(childAnchor);

    const cp1X = startX + startDir.dx * controlOffset;
    const cp1Y = startY + startDir.dy * controlOffset;
    const cp2X = endX + endDir.dx * controlOffset;
    const cp2Y = endY + endDir.dy * controlOffset;

    const path = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;

    // Calculate midpoint using De Casteljau
    const midpoint = this.getBezierMidpoint(
      { x: startX, y: startY },
      { x: cp1X, y: cp1Y },
      { x: cp2X, y: cp2Y },
      { x: endX, y: endY }
    );

    return { path, midpoint };
  }
}
