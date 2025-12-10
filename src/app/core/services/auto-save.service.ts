import { Injectable, inject, effect, DestroyRef } from '@angular/core';
import { MindMapStore } from '../../store/mind-map.store';
import { MindMapService } from './mind-map.service';
import { PreviewGeneratorService } from './preview-generator.service';

@Injectable({
  providedIn: 'root',
})
export class AutoSaveService {
  private store = inject(MindMapStore);
  private mindMapService = inject(MindMapService);
  private previewGenerator = inject(PreviewGeneratorService);

  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly DEBOUNCE_MS = 2000; // Wait 2 seconds after last change

  private isEnabled = false;
  private isSaving = false;

  /**
   * Enable auto-save for the current map session
   */
  enable(): void {
    this.isEnabled = true;
  }

  /**
   * Disable auto-save
   */
  disable(): void {
    this.isEnabled = false;
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
  }

  /**
   * Trigger a debounced save (call this when changes are detected)
   */
  triggerSave(): void {
    if (!this.isEnabled) return;

    // Clear existing timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Set new timeout
    this.saveTimeout = setTimeout(() => {
      this.performSave();
    }, this.DEBOUNCE_MS);
  }

  /**
   * Force an immediate save (e.g., before navigation)
   */
  async saveNow(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    await this.performSave();
  }

  /**
   * Check if there are pending changes
   */
  hasPendingChanges(): boolean {
    return this.store.hasPendingChanges();
  }

  /**
   * Perform the actual save operation
   */
  private async performSave(): Promise<void> {
    if (this.isSaving) return;
    if (!this.store.hasPendingChanges()) return;

    const map = this.store.currentMap();
    if (!map) return;

    this.isSaving = true;

    try {
      const dirtyNodes = this.store.getDirtyNodes();
      const deletedNodeIds = this.store.getDeletedNodeIds();
      const mapNeedsUpdate = this.store.mapDirty();

      console.log(`Auto-saving: ${dirtyNodes.length} nodes, ${deletedNodeIds.length} deletions`);

      // Save dirty nodes
      if (dirtyNodes.length > 0) {
        await this.mindMapService.saveNodes(dirtyNodes);
      }

      // Delete removed nodes
      if (deletedNodeIds.length > 0) {
        await this.mindMapService.deleteNodesByIds(deletedNodeIds);
      }

      // Update map with new preview if needed
      if (mapNeedsUpdate) {
        const nodes = Object.values(this.store.nodes());
        const positions = this.store.nodePositions();
        const previewSvg = this.previewGenerator.generatePreview(nodes, positions);
        await this.mindMapService.updateMap(map.id, { previewSvg });
      } else {
        // Just update the timestamp
        await this.mindMapService.updateMap(map.id, {});
      }

      // Clear dirty state after successful save
      this.store.clearDirtyState();
      console.log('Auto-save complete');
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      this.isSaving = false;
    }
  }
}
