import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MindMapStore } from '../../store/mind-map.store';
import { NodeComponent } from '../node/node.component';
import { ConnectionLayerComponent } from './connection-layer.component';

@Component({
  selector: 'app-canvas',
  standalone: true,
  imports: [NodeComponent, ConnectionLayerComponent],
  template: `
    <div
      class="canvas-container"
      #canvasContainer
      (mousedown)="onMouseDown($event)"
      (mousemove)="onMouseMove($event)"
      (mouseup)="onMouseUp($event)"
      (mouseleave)="onMouseUp($event)"
      (wheel)="onWheel($event)"
      (click)="onCanvasClick($event)"
    >
      <div class="canvas-layer" [style.transform]="transformStyle()">
        <app-connection-layer />

        @for (node of store.nodesArray(); track node.id) {
          <app-node
            [node]="node"
            [isSelected]="node.id === store.selectedNodeId()"
            [isEditing]="node.id === store.editingNodeId()"
            (nodeClick)="onNodeClick($event)"
            (nodeDblClick)="onNodeDblClick($event)"
            (nodePositionChange)="onNodePositionChange($event)"
            (nodeTextChange)="onNodeTextChange($event)"
            (addChildRequest)="addChildNode($event)"
            (addSiblingRequest)="addSiblingNode($event)"
            (deleteRequest)="deleteNode($event)"
          />
        }
      </div>
    </div>

    <div class="zoom-controls">
      <button class="zoom-btn" (click)="store.zoomOut()" title="Zoom Out">−</button>
      <span class="zoom-level">{{ zoomPercentage() }}%</span>
      <button class="zoom-btn" (click)="store.zoomIn()" title="Zoom In">+</button>
      <button class="zoom-btn reset" (click)="store.resetView()" title="Reset View">⟲</button>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    .canvas-container {
      width: 100%;
      height: 100%;
      background-color: var(--canvas-bg);
      background-image: radial-gradient(circle, #ccc 1px, transparent 1px);
      background-size: 20px 20px;
      cursor: grab;
      position: relative;
      overflow: hidden;

      &.panning {
        cursor: grabbing;
      }
    }

    .canvas-layer {
      position: absolute;
      top: 50%;
      left: 50%;
      transform-origin: 0 0;
      will-change: transform;
    }

    .zoom-controls {
      position: absolute;
      bottom: 16px;
      right: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--node-bg);
      padding: 8px 12px;
      border-radius: 24px;
      box-shadow: 0 2px 8px var(--node-shadow);
    }

    .zoom-btn {
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 50%;
      background: transparent;
      cursor: pointer;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s;

      &:hover {
        background: rgba(0, 0, 0, 0.08);
      }

      &.reset {
        font-size: 16px;
      }
    }

    .zoom-level {
      min-width: 48px;
      text-align: center;
      font-size: 14px;
      font-weight: 500;
    }
  `,
})
export class CanvasComponent {
  readonly store = inject(MindMapStore);

  private canvasContainer = viewChild<ElementRef<HTMLDivElement>>('canvasContainer');

  private isPanning = signal(false);
  private lastMousePos = signal({ x: 0, y: 0 });

  readonly transformStyle = computed(() => {
    const view = this.store.view();
    return `translate(${view.panX}px, ${view.panY}px) scale(${view.scale})`;
  });

  readonly zoomPercentage = computed(() => Math.round(this.store.view().scale * 100));

  onMouseDown(event: MouseEvent): void {
    // Only pan with middle mouse button or when not clicking on a node
    if (event.button === 1 || (event.button === 0 && event.target === event.currentTarget)) {
      this.isPanning.set(true);
      this.lastMousePos.set({ x: event.clientX, y: event.clientY });
      this.canvasContainer()?.nativeElement.classList.add('panning');
      event.preventDefault();
    }
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.isPanning()) return;

    const dx = event.clientX - this.lastMousePos().x;
    const dy = event.clientY - this.lastMousePos().y;

    this.store.updateView({
      panX: this.store.view().panX + dx,
      panY: this.store.view().panY + dy,
    });

    this.lastMousePos.set({ x: event.clientX, y: event.clientY });
  }

  onMouseUp(event: MouseEvent): void {
    this.isPanning.set(false);
    this.canvasContainer()?.nativeElement.classList.remove('panning');
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();

    const container = this.canvasContainer()?.nativeElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left - rect.width / 2;
    const mouseY = event.clientY - rect.top - rect.height / 2;

    const view = this.store.view();
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(view.scale * zoomFactor, 0.3), 3);

    // Zoom towards mouse position
    const scaleChange = newScale / view.scale;
    const newPanX = mouseX - (mouseX - view.panX) * scaleChange;
    const newPanY = mouseY - (mouseY - view.panY) * scaleChange;

    this.store.updateView({
      scale: newScale,
      panX: newPanX,
      panY: newPanY,
    });
  }

  onCanvasClick(event: MouseEvent): void {
    // Deselect when clicking on empty canvas
    if (event.target === event.currentTarget) {
      this.store.selectNode(null);
    }
  }

  onNodeClick(nodeId: string): void {
    this.store.selectNode(nodeId);
  }

  onNodeDblClick(nodeId: string): void {
    this.store.startEditing(nodeId);
  }

  onNodePositionChange(event: { nodeId: string; position: { x: number; y: number } }): void {
    // Use the new setNodeOffset method which calculates offset from computed position
    this.store.setNodeOffset(event.nodeId, event.position);
  }

  onNodeTextChange(event: { nodeId: string; text: string }): void {
    this.store.updateNode(event.nodeId, { text: event.text });
    this.store.stopEditing();
  }

  deleteNode(nodeId: string): void {
    this.store.deleteNode(nodeId);
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const selectedId = this.store.selectedNodeId();
    if (!selectedId) return;

    // Don't handle shortcuts when editing
    if (this.store.editingNodeId()) return;

    switch (event.key) {
      case 'Tab':
        event.preventDefault();
        this.addChildNode(selectedId);
        break;
      case 'Enter':
        event.preventDefault();
        this.addSiblingNode(selectedId);
        break;
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        this.store.deleteNode(selectedId);
        break;
      case 'F2':
        event.preventDefault();
        this.store.startEditing(selectedId);
        break;
      case 'z':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          if (event.shiftKey) {
            this.store.redo();
          } else {
            this.store.undo();
          }
        }
        break;
      case 'y':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.store.redo();
        }
        break;
    }
  }

  addChildNode(parentId: string): void {
    const parent = this.store.nodes()[parentId];
    if (!parent) return;

    const map = this.store.currentMap();
    if (!map) return;

    const childCount = parent.childrenIds.length;

    // New nodes don't need position - it's computed automatically
    const newNode = {
      id: this.store.generateId(),
      userId: parent.userId,
      mapId: parent.mapId,
      parentId: parent.id,
      text: 'New Node',
      isExpanded: true,
      childrenIds: [],
      order: childCount,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.store.addNode(newNode);
    this.store.startEditing(newNode.id);
  }

  addSiblingNode(nodeId: string): void {
    const node = this.store.nodes()[nodeId];
    if (!node || !node.parentId) return; // Can't add sibling to root

    const parent = this.store.nodes()[node.parentId];
    if (!parent) return;

    const siblingCount = parent.childrenIds.length;

    // New nodes don't need position - it's computed automatically
    const newNode = {
      id: this.store.generateId(),
      userId: node.userId,
      mapId: node.mapId,
      parentId: parent.id,
      text: 'New Node',
      isExpanded: true,
      childrenIds: [],
      order: siblingCount,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.store.addNode(newNode);
    this.store.startEditing(newNode.id);
  }
}
