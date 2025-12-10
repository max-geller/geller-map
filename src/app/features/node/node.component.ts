import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { CdkDrag, CdkDragEnd, CdkDragHandle, CdkDragMove, CdkDragStart } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MindMapNode, Position } from '../../core/models/mind-map.model';
import { MindMapStore } from '../../store/mind-map.store';

@Component({
  selector: 'app-node',
  standalone: true,
  imports: [CdkDrag, CdkDragHandle, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    <div
      class="node-container"
      [style.left.px]="position().x"
      [style.top.px]="position().y"
      cdkDrag
      (cdkDragStarted)="onDragStarted()"
      (cdkDragMoved)="onDragMoved($event)"
      (cdkDragEnded)="onDragEnded($event)"
    >
      <div
        class="node"
        cdkDragHandle
        [class.selected]="isSelected()"
        [class.editing]="isEditing()"
        [class.root]="!node().parentId"
        [class.has-offset]="node().manualOffset"
        [style.background-color]="nodeColor()"
        (click)="onClick($event)"
        (dblclick)="onDblClick($event)"
      >
        @if (isEditing()) {
          <input
            #textInput
            type="text"
            class="node-input"
            [value]="node().text"
            (blur)="onBlur($event)"
            (keydown.enter)="onEnter($event)"
            (keydown.escape)="onEscape($event)"
            (click)="$event.stopPropagation()"
          />
        } @else {
          <span class="node-text">{{ node().text }}</span>
        }

        @if (node().task?.isComplete !== undefined) {
          <span class="task-indicator" [class.complete]="node().task?.isComplete">
            {{ node().task?.isComplete ? '✓' : '○' }}
          </span>
        }
      </div>

      <!-- Add child button -->
      @if (isSelected()) {
        <button
          class="add-btn add-child"
          mat-mini-fab
          color="primary"
          matTooltip="Add child (Tab)"
          (mousedown)="$event.stopPropagation()"
          (click)="onAddChild($event)"
        >
          <mat-icon>add</mat-icon>
        </button>
      }

      <!-- Add sibling button (only for non-root) -->
      @if (isSelected() && node().parentId) {
        <button
          class="add-btn add-sibling"
          mat-mini-fab
          color="accent"
          matTooltip="Add sibling (Enter)"
          (mousedown)="$event.stopPropagation()"
          (click)="onAddSibling($event)"
        >
          <mat-icon>add</mat-icon>
        </button>
      }

      <!-- Delete button (only for non-root) -->
      @if (isSelected() && node().parentId) {
        <button
          class="action-btn delete-btn"
          mat-mini-fab
          color="warn"
          matTooltip="Delete (Del)"
          (mousedown)="$event.stopPropagation()"
          (click)="onDelete($event)"
        >
          <mat-icon>delete</mat-icon>
        </button>
      }

      <!-- Edit/Rename button -->
      @if (isSelected() && !isEditing()) {
        <button
          class="action-btn edit-btn"
          mat-mini-fab
          matTooltip="Rename (F2 or double-click)"
          (mousedown)="$event.stopPropagation()"
          (click)="onEdit($event)"
        >
          <mat-icon>edit</mat-icon>
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      position: absolute;
      z-index: 1;
    }

    .node-container {
      position: absolute;
    }

    .node {
      width: 150px;
      min-height: 48px;
      padding: 12px 16px;
      background: var(--node-bg);
      border: 2px solid var(--node-border);
      border-radius: 8px;
      box-shadow: 0 2px 4px var(--node-shadow);
      cursor: grab;
      user-select: none;
      transition:
        box-shadow 0.2s,
        border-color 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
      box-sizing: border-box;

      &:hover {
        box-shadow: 0 4px 8px var(--node-shadow);
      }

      &:active {
        cursor: grabbing;
      }

      &.selected {
        border-color: var(--selection-color);
        box-shadow: 0 0 0 3px rgba(124, 77, 255, 0.2);
      }

      &.editing {
        border-color: var(--selection-color);
        cursor: text;
      }

      &.root {
        font-weight: 600;
        font-size: 16px;
        width: 170px;
        border-radius: 12px;
      }

      &.has-offset {
        // Visual indicator that node has been manually positioned
        border-style: dashed;
      }
    }

    .node-text {
      flex: 1;
      word-break: break-word;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .node-input {
      flex: 1;
      border: none;
      background: transparent;
      font: inherit;
      color: inherit;
      outline: none;
      width: 100%;
    }

    .task-indicator {
      font-size: 14px;
      color: #888;

      &.complete {
        color: #4caf50;
      }
    }

    .add-btn,
    .action-btn {
      position: absolute;
      z-index: 10;
      transform: scale(0.8);
    }

    .add-btn.add-child {
      right: -48px;
      top: 50%;
      transform: translateY(-50%) scale(0.8);
    }

    .add-btn.add-sibling {
      bottom: -48px;
      left: 50%;
      transform: translateX(-50%) scale(0.8);
    }

    .delete-btn {
      top: -44px;
      right: 4px;
      transform: scale(0.75);
      opacity: 0.85;

      &:hover {
        transform: scale(0.85);
        opacity: 1;
      }
    }

    .edit-btn {
      top: -44px;
      left: 4px;
      transform: scale(0.75);
      opacity: 0.85;
      background-color: #616161 !important;

      &:hover {
        transform: scale(0.85);
        opacity: 1;
      }
    }
  `,
})
export class NodeComponent {
  private store = inject(MindMapStore);

  readonly node = input.required<MindMapNode>();
  readonly isSelected = input(false);
  readonly isEditing = input(false);

  readonly nodeClick = output<string>();
  readonly nodeDblClick = output<string>();
  readonly nodePositionChange = output<{ nodeId: string; position: Position }>();
  readonly nodeTextChange = output<{ nodeId: string; text: string }>();
  readonly addChildRequest = output<string>();
  readonly addSiblingRequest = output<string>();
  readonly deleteRequest = output<string>();

  private textInput = viewChild<ElementRef<HTMLInputElement>>('textInput');

  /**
   * Get the final position from the store's computed positions
   */
  readonly position = computed(() => {
    return this.store.getNodePosition(this.node().id);
  });

  readonly nodeColor = computed(() => {
    const style = this.node().style;
    return style?.color || 'var(--node-bg)';
  });

  constructor() {
    // Focus input when editing starts
    effect(() => {
      if (this.isEditing()) {
        setTimeout(() => {
          const input = this.textInput()?.nativeElement;
          if (input) {
            input.focus();
            input.select();
          }
        }, 0);
      }
    });
  }

  onClick(event: MouseEvent): void {
    event.stopPropagation();
    this.nodeClick.emit(this.node().id);
  }

  onDblClick(event: MouseEvent): void {
    event.stopPropagation();
    this.nodeDblClick.emit(this.node().id);
  }

  onDragStarted(): void {
    // Initialize drag state for live connection updates
    this.store.setDraggingState({ nodeId: this.node().id, delta: { x: 0, y: 0 } });
  }

  onDragMoved(event: CdkDragMove): void {
    // Update drag state with current delta for live connection updates
    this.store.setDraggingState({
      nodeId: this.node().id,
      delta: event.distance,
    });
  }

  onDragEnded(event: CdkDragEnd): void {
    // Clear drag state first
    this.store.setDraggingState(null);

    const element = event.source.element.nativeElement;
    const transform = element.style.transform;

    // Parse the transform to get the delta
    const match = transform.match(/translate3d\(([^,]+)px,\s*([^,]+)px/);
    if (match) {
      const deltaX = parseFloat(match[1]);
      const deltaY = parseFloat(match[2]);

      const currentPos = this.position();
      const newPosition = {
        x: currentPos.x + deltaX,
        y: currentPos.y + deltaY,
      };

      this.nodePositionChange.emit({
        nodeId: this.node().id,
        position: newPosition,
      });
    }

    // Reset the drag transform
    event.source.reset();
  }

  onBlur(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    if (input.value.trim()) {
      this.nodeTextChange.emit({
        nodeId: this.node().id,
        text: input.value.trim(),
      });
    } else {
      this.store.stopEditing();
    }
  }

  onEnter(event: Event): void {
    event.preventDefault();
    const input = event.target as HTMLInputElement;
    if (input.value.trim()) {
      this.nodeTextChange.emit({
        nodeId: this.node().id,
        text: input.value.trim(),
      });
    }
  }

  onEscape(event: Event): void {
    event.preventDefault();
    this.store.stopEditing();
  }

  onAddChild(event: MouseEvent): void {
    event.stopPropagation();
    this.addChildRequest.emit(this.node().id);
  }

  onAddSibling(event: MouseEvent): void {
    event.stopPropagation();
    this.addSiblingRequest.emit(this.node().id);
  }

  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.deleteRequest.emit(this.node().id);
  }

  onEdit(event: MouseEvent): void {
    event.stopPropagation();
    this.nodeDblClick.emit(this.node().id);
  }
}
