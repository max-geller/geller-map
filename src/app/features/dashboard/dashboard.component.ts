import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { MindMapService } from '../../core/services/mind-map.service';
import { MindMap } from '../../core/models/mind-map.model';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatMenuModule,
    MatDialogModule,
    MatInputModule,
    MatFormFieldModule,
    FormsModule,
    DatePipe,
  ],
  template: `
    <div class="dashboard">
      <header class="header">
        <h1>Geller Map</h1>
        <div class="header-actions">
          <span class="user-name">{{ authService.currentUser()?.displayName }}</span>
          <button mat-icon-button [matMenuTriggerFor]="userMenu">
            @if (authService.currentUser()?.photoURL) {
              <img
                [src]="authService.currentUser()?.photoURL"
                alt="User"
                class="user-avatar"
              />
            } @else {
              <mat-icon>account_circle</mat-icon>
            }
          </button>
          <mat-menu #userMenu="matMenu">
            <button mat-menu-item (click)="logout()">
              <mat-icon>logout</mat-icon>
              <span>Logout</span>
            </button>
          </mat-menu>
        </div>
      </header>

      <main class="content">
        <div class="toolbar">
          <h2>My Mind Maps</h2>
          <button mat-raised-button color="primary" (click)="showCreateDialog = true">
            <mat-icon>add</mat-icon>
            New Map
          </button>
        </div>

        @if (showCreateDialog) {
          <mat-card class="create-dialog">
            <mat-card-content>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Map Name</mat-label>
                <input matInput [(ngModel)]="newMapName" placeholder="Enter a name for your map" />
              </mat-form-field>
            </mat-card-content>
            <mat-card-actions align="end">
              <button mat-button (click)="showCreateDialog = false">Cancel</button>
              <button
                mat-raised-button
                color="primary"
                [disabled]="!newMapName.trim()"
                (click)="createMap()"
              >
                Create
              </button>
            </mat-card-actions>
          </mat-card>
        }

        <div class="maps-grid">
          @for (map of mindMapService.maps(); track map.id) {
            <mat-card class="map-card" (click)="openMap(map)">
              <mat-card-header>
                <mat-card-title>{{ map.name }}</mat-card-title>
                <mat-card-subtitle>Updated {{ map.updatedAt | date : 'medium' }}</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <div class="map-preview">
                  <mat-icon>account_tree</mat-icon>
                </div>
              </mat-card-content>
              <mat-card-actions>
                <button mat-icon-button (click)="openMapMenu($event, map)" [matMenuTriggerFor]="mapMenu">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #mapMenu="matMenu">
                  <button mat-menu-item (click)="deleteMap(selectedMap!)">
                    <mat-icon>delete</mat-icon>
                    <span>Delete</span>
                  </button>
                </mat-menu>
              </mat-card-actions>
            </mat-card>
          } @empty {
            <div class="empty-state">
              <mat-icon>lightbulb</mat-icon>
              <h3>No mind maps yet</h3>
              <p>Create your first mind map to start organizing your ideas!</p>
              <button mat-raised-button color="primary" (click)="showCreateDialog = true">
                Create Mind Map
              </button>
            </div>
          }
        </div>
      </main>
    </div>
  `,
  styles: `
    .dashboard {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: var(--node-bg);
      box-shadow: 0 2px 4px var(--node-shadow);

      h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 600;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .user-name {
      font-size: 14px;
      color: rgba(0, 0, 0, 0.6);
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
    }

    .content {
      flex: 1;
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
      width: 100%;
    }

    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;

      h2 {
        margin: 0;
      }
    }

    .create-dialog {
      margin-bottom: 24px;
      max-width: 400px;
    }

    .full-width {
      width: 100%;
    }

    .maps-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 24px;
    }

    .map-card {
      cursor: pointer;
      transition:
        transform 0.2s,
        box-shadow 0.2s;

      &:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 16px var(--node-shadow);
      }
    }

    .map-preview {
      height: 100px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--canvas-bg);
      border-radius: 8px;
      margin-top: 16px;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--connection-color);
      }
    }

    .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 64px 24px;
      background: var(--node-bg);
      border-radius: 16px;
      border: 2px dashed var(--node-border);

      mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: var(--connection-color);
        margin-bottom: 16px;
      }

      h3 {
        margin: 0 0 8px;
      }

      p {
        color: rgba(0, 0, 0, 0.6);
        margin-bottom: 24px;
      }
    }
  `,
})
export class DashboardComponent {
  readonly authService = inject(AuthService);
  readonly mindMapService = inject(MindMapService);
  private router = inject(Router);

  showCreateDialog = false;
  newMapName = '';
  selectedMap: MindMap | null = null;

  async createMap(): Promise<void> {
    const user = this.authService.currentUser();
    if (!user || !this.newMapName.trim()) return;

    try {
      const { map } = await this.mindMapService.createMap(this.newMapName.trim(), user.uid);
      this.showCreateDialog = false;
      this.newMapName = '';
      this.router.navigate(['/map', map.id]);
    } catch (error) {
      console.error('Failed to create map:', error);
    }
  }

  openMap(map: MindMap): void {
    this.router.navigate(['/map', map.id]);
  }

  openMapMenu(event: MouseEvent, map: MindMap): void {
    event.stopPropagation();
    this.selectedMap = map;
  }

  async deleteMap(map: MindMap): Promise<void> {
    const user = this.authService.currentUser();
    if (!user) return;
    if (!confirm(`Are you sure you want to delete "${map.name}"?`)) return;

    try {
      await this.mindMapService.deleteMap(map.id, user.uid);
    } catch (error) {
      console.error('Failed to delete map:', error);
    }
  }

  async logout(): Promise<void> {
    await this.authService.logout();
  }
}
