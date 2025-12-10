import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MindMapStore } from '../../store/mind-map.store';
import { MindMapService } from '../../core/services/mind-map.service';
import { AuthService } from '../../core/services/auth.service';
import { CanvasComponent } from '../canvas/canvas.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatMenuModule,
    MatTooltipModule,
    CanvasComponent,
  ],
  template: `
    <div class="editor">
      <mat-toolbar class="toolbar">
        <button mat-icon-button (click)="goBack()" matTooltip="Back to Dashboard">
          <mat-icon>arrow_back</mat-icon>
        </button>

        <span class="map-title">{{ store.currentMap()?.name || 'Loading...' }}</span>

        <span class="spacer"></span>

        <button
          mat-icon-button
          (click)="store.undo()"
          [disabled]="!store.canUndo()"
          matTooltip="Undo (Ctrl+Z)"
        >
          <mat-icon>undo</mat-icon>
        </button>

        <button
          mat-icon-button
          (click)="store.redo()"
          [disabled]="!store.canRedo()"
          matTooltip="Redo (Ctrl+Y)"
        >
          <mat-icon>redo</mat-icon>
        </button>

        <button mat-icon-button (click)="saveMap()" matTooltip="Save" [disabled]="isSaving()">
          <mat-icon>{{ isSaving() ? 'sync' : 'save' }}</mat-icon>
        </button>

        <button mat-icon-button [matMenuTriggerFor]="moreMenu" matTooltip="More options">
          <mat-icon>more_vert</mat-icon>
        </button>

        <mat-menu #moreMenu="matMenu">
          <button mat-menu-item (click)="store.resetView()">
            <mat-icon>center_focus_strong</mat-icon>
            <span>Reset View</span>
          </button>
          <button mat-menu-item (click)="exportAsJson()">
            <mat-icon>download</mat-icon>
            <span>Export as JSON</span>
          </button>
        </mat-menu>
      </mat-toolbar>

      @if (isLoading()) {
        <div class="loading">
          <mat-icon>hourglass_empty</mat-icon>
          <p>Loading map...</p>
        </div>
      } @else if (error()) {
        <div class="error">
          <mat-icon>error</mat-icon>
          <p>{{ error() }}</p>
          <button mat-raised-button color="primary" (click)="goBack()">Go Back</button>
        </div>
      } @else {
        <app-canvas />
      }
    </div>
  `,
  styles: `
    .editor {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    .toolbar {
      background: var(--node-bg);
      border-bottom: 1px solid var(--node-border);
    }

    .map-title {
      font-weight: 500;
      margin-left: 8px;
    }

    .spacer {
      flex: 1;
    }

    app-canvas {
      flex: 1;
    }

    .loading,
    .error {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--connection-color);
      }
    }

    .error {
      mat-icon {
        color: #f44336;
      }
    }
  `,
})
export class EditorComponent implements OnInit, OnDestroy {
  readonly store = inject(MindMapStore);
  private mindMapService = inject(MindMapService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  isLoading = signal(true);
  isSaving = signal(false);
  error = signal<string | null>(null);

  private subscription: Subscription | null = null;

  ngOnInit(): void {
    const mapId = this.route.snapshot.paramMap.get('id');
    if (mapId) {
      this.loadMap(mapId);
    } else {
      this.error.set('No map ID provided');
      this.isLoading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.store.clearMap();
  }

  private async loadMap(mapId: string): Promise<void> {
    const user = this.authService.currentUser();
    if (!user) {
      this.error.set('Not authenticated');
      this.isLoading.set(false);
      return;
    }

    try {
      const map = await this.mindMapService.getMap(mapId);
      if (!map) {
        this.error.set('Map not found');
        this.isLoading.set(false);
        return;
      }

      const nodes = await this.mindMapService.getNodesOnce(mapId, user.uid);
      this.store.loadMap(map, nodes);
      this.isLoading.set(false);

      // Subscribe to real-time updates
      this.subscription = this.mindMapService.getNodes(mapId, user.uid).subscribe((updatedNodes) => {
        // Only update if we have nodes (prevents clearing on initial load race)
        if (updatedNodes.length > 0 && !this.isLoading()) {
          // Optionally sync with remote changes
          // For now, we'll rely on local state and save manually
        }
      });
    } catch (err) {
      console.error('Failed to load map:', err);
      this.error.set('Failed to load map');
      this.isLoading.set(false);
    }
  }

  async saveMap(): Promise<void> {
    const map = this.store.currentMap();
    if (!map) return;

    this.isSaving.set(true);
    try {
      const nodes = Object.values(this.store.nodes());
      await this.mindMapService.batchUpdateNodes(nodes);
      await this.mindMapService.updateMap(map.id, { name: map.name });
    } catch (err) {
      console.error('Failed to save map:', err);
    } finally {
      this.isSaving.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  exportAsJson(): void {
    const map = this.store.currentMap();
    const nodes = this.store.nodes();

    if (!map) return;

    const data = {
      map,
      nodes: Object.values(nodes),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${map.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
