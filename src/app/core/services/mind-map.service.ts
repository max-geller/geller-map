import { Injectable, inject, Injector, runInInjectionContext, Signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import {
  collection,
  collectionData,
  query,
  where,
  orderBy,
} from '@angular/fire/firestore';
import { Firestore } from '@angular/fire/firestore';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { DbService } from './db.service';
import { AuthService } from './auth.service';
import { MindMap, MindMapNode } from '../models/mind-map.model';

@Injectable({
  providedIn: 'root',
})
export class MindMapService {
  private db = inject(DbService);
  private authService = inject(AuthService);
  private firestore = inject(Firestore);
  private injector = inject(Injector);

  // Signal for all maps of the current user
  readonly maps: Signal<MindMap[]> = toSignal(
    toObservable(this.authService.currentUser).pipe(
      switchMap((user) => {
        if (user?.uid) {
          return this.getMaps(user.uid);
        }
        return of([]);
      })
    ),
    { initialValue: [] }
  );

  /**
   * Get all mind maps for a user
   */
  getMaps(userId: string): Observable<MindMap[]> {
    return runInInjectionContext(this.injector, () => {
      const mapsRef = collection(this.firestore, 'mindmaps');
      const q = query(mapsRef, where('userId', '==', userId), orderBy('updatedAt', 'desc'));
      return (collectionData(q, { idField: 'id' }) as Observable<MindMap[]>).pipe(
        map((maps) => maps.map((m) => this.db.convertDates(m) as MindMap)),
        shareReplay({ bufferSize: 1, refCount: true })
      );
    });
  }

  /**
   * Get a single mind map by ID
   */
  async getMap(mapId: string): Promise<MindMap | null> {
    return await this.db.getDocument<MindMap>('mindmaps', mapId);
  }

  /**
   * Get all nodes for a mind map
   */
  getNodes(mapId: string, userId: string): Observable<MindMapNode[]> {
    return runInInjectionContext(this.injector, () => {
      const nodesRef = collection(this.firestore, 'mindmapNodes');
      const q = query(
        nodesRef,
        where('userId', '==', userId),
        where('mapId', '==', mapId)
      );
      return (collectionData(q, { idField: 'id' }) as Observable<MindMapNode[]>).pipe(
        map((nodes) => nodes.map((n) => this.db.convertDates(n) as MindMapNode))
      );
    });
  }

  /**
   * Get nodes as a one-time fetch
   */
  async getNodesOnce(mapId: string, userId: string): Promise<MindMapNode[]> {
    return await this.db.getDocuments<MindMapNode>(
      'mindmapNodes',
      where('userId', '==', userId),
      where('mapId', '==', mapId)
    );
  }

  /**
   * Create a new mind map with a root node
   */
  async createMap(
    name: string,
    userId: string,
    description?: string
  ): Promise<{ map: MindMap; rootNode: MindMapNode }> {
    const now = new Date();
    const mapId = `map_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const rootNodeId = `node_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const map: MindMap = {
      id: mapId,
      userId,
      name,
      description,
      rootNodeId,
      settings: {
        theme: 'system',
        layoutMode: 'freeform',
      },
      createdAt: now,
      updatedAt: now,
    };

    const rootNode: MindMapNode = {
      id: rootNodeId,
      userId,
      mapId,
      parentId: null,
      text: name,
      // Position is now computed by LayoutService, no need to store
      isExpanded: true,
      childrenIds: [],
      order: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.setDocument('mindmaps', mapId, map);
    await this.db.setDocument('mindmapNodes', rootNodeId, rootNode);

    return { map, rootNode };
  }

  /**
   * Update a mind map
   */
  async updateMap(mapId: string, updates: Partial<MindMap>): Promise<void> {
    await this.db.updateDocument('mindmaps', mapId, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  /**
   * Delete a mind map and all its nodes
   */
  async deleteMap(mapId: string, userId: string): Promise<void> {
    // Get all nodes for this map
    const nodes = await this.getNodesOnce(mapId, userId);

    // Delete all nodes
    await Promise.all(nodes.map((node) => this.db.deleteDocument('mindmapNodes', node.id)));

    // Delete the map
    await this.db.deleteDocument('mindmaps', mapId);
  }

  /**
   * Create a new node
   */
  async createNode(node: Omit<MindMapNode, 'id' | 'createdAt' | 'updatedAt'>): Promise<MindMapNode> {
    const now = new Date();
    const nodeId = `node_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const newNode: MindMapNode = {
      ...node,
      id: nodeId,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.setDocument('mindmapNodes', nodeId, newNode);

    // Update parent's childrenIds
    if (node.parentId) {
      const parent = await this.db.getDocument<MindMapNode>('mindmapNodes', node.parentId);
      if (parent) {
        await this.db.updateDocument('mindmapNodes', node.parentId, {
          childrenIds: [...parent.childrenIds, nodeId],
          updatedAt: now,
        });
      }
    }

    // Update map's updatedAt
    await this.updateMap(node.mapId, {});

    return newNode;
  }

  /**
   * Update a node
   */
  async updateNode(nodeId: string, updates: Partial<MindMapNode>): Promise<void> {
    const node = await this.db.getDocument<MindMapNode>('mindmapNodes', nodeId);
    if (!node) return;

    await this.db.updateDocument('mindmapNodes', nodeId, {
      ...updates,
      updatedAt: new Date(),
    });

    // Update map's updatedAt
    await this.updateMap(node.mapId, {});
  }

  /**
   * Delete a node and optionally its children
   */
  async deleteNode(nodeId: string, deleteChildren = true): Promise<void> {
    const node = await this.db.getDocument<MindMapNode>('mindmapNodes', nodeId);
    if (!node || !node.parentId) return; // Can't delete root node

    // Get all descendant nodes if deleting children
    const nodesToDelete: string[] = [nodeId];
    if (deleteChildren) {
      await this.collectDescendants(nodeId, nodesToDelete);
    }

    // Delete all nodes
    await Promise.all(nodesToDelete.map((id) => this.db.deleteDocument('mindmapNodes', id)));

    // Update parent's childrenIds
    const parent = await this.db.getDocument<MindMapNode>('mindmapNodes', node.parentId);
    if (parent) {
      await this.db.updateDocument('mindmapNodes', node.parentId, {
        childrenIds: parent.childrenIds.filter((id) => id !== nodeId),
        updatedAt: new Date(),
      });
    }

    // Update map's updatedAt
    await this.updateMap(node.mapId, {});
  }

  private async collectDescendants(nodeId: string, result: string[]): Promise<void> {
    const node = await this.db.getDocument<MindMapNode>('mindmapNodes', nodeId);
    if (!node) return;

    for (const childId of node.childrenIds) {
      result.push(childId);
      await this.collectDescendants(childId, result);
    }
  }

  /**
   * Move a node to a new position
   */
  async moveNode(nodeId: string, position: { x: number; y: number }): Promise<void> {
    await this.updateNode(nodeId, { position });
  }

  /**
   * Batch update multiple nodes (for saving entire map state)
   */
  async batchUpdateNodes(nodes: MindMapNode[]): Promise<void> {
    const now = new Date();
    await Promise.all(
      nodes.map((node) =>
        this.db.setDocument('mindmapNodes', node.id, {
          ...node,
          updatedAt: now,
        })
      )
    );
  }

  /**
   * Save only the specified dirty nodes (incremental save)
   */
  async saveNodes(nodes: MindMapNode[]): Promise<void> {
    if (nodes.length === 0) return;

    const now = new Date();
    await Promise.all(
      nodes.map((node) =>
        this.db.setDocument('mindmapNodes', node.id, {
          ...node,
          updatedAt: now,
        })
      )
    );
  }

  /**
   * Delete nodes by their IDs
   */
  async deleteNodesByIds(nodeIds: string[]): Promise<void> {
    if (nodeIds.length === 0) return;

    await Promise.all(
      nodeIds.map((id) => this.db.deleteDocument('mindmapNodes', id))
    );
  }
}
