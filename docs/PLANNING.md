# Geller Map - Project Plan

## Overview

Building a modern, collaborative mind-mapping application similar to MindMeister or Coggle, leveraging **Angular 20** and **Material Design 3**.

## Core Goals

1. **Fluid UX**: Infinite canvas, smooth zooming/panning, and intuitive node manipulation.
2. **Modern Tech Stack**: Full usage of Angular 20 features (Zoneless, Signals, Control Flow) and Material 3 density/theming.
3. **Simplicity & Power**: Focus on "thought speed" initially, expanding to rich collaboration and productivity tools.

## Feature Specification

### 1. Core Mind Mapping

- **Canvas**: Infinite panning, smooth zooming (viewport ruler integration).
- **Nodes**: Hierarchical structure, drag-and-drop reordering.
  - _Content_: Rich text, emojis, icons, hyperlinks.
  - _Styling_: Custom colors, shapes, fonts, themes (Light/Dark).
  - _Layout_: Auto-aligned (Tree) vs Free-form options.
- **History**: Undo/Redo stack, Playback mode (version history).

### 2. Productivity & Organization

- **Tasks**: Assign due dates, priorities, and progress to nodes.
- **Views**: Toggle between Visual Map and Linear Outline.
- **Focus Mode**: Highlight specific branches, dimming others.
- **Templates**: Pre-built JSON configs for common use cases.

### 3. Collaboration & Media (Phase 3+)

- **Real-time**: Multi-user editing (Firebase/WebSockets).
- **Sharing**: Read-only vs Edit links, Social export.
- **Media**: Image/Video attachments, File uploads.
- **Integration**: Google Drive/Dropbox import.
- **Export**: PDF, PNG, Markdown, Freemind formats.

## Architecture

### Tech Stack

- **Framework**: Angular 20 (Zoneless enabled)
- **UI Library**: Angular Material 20 (Components + CDK)
- **Backend**: Firebase (Firestore) - **Dedicated project: `geller-map`**
- **State Management**: `MindMapStore` (Signals).
  - _History_: Action-based state for easy Undo/Redo.
- **Rendering**:
  - **Connections**: SVG Layer (Bezier curves).
  - **Nodes**: HTML/CSS Layer.
  - **Canvas**: Custom CSS Transform.

### Firebase Configuration

**Project**: `geller-map` (dedicated)

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  firebase: {
    apiKey: 'AIzaSyAo72HZfH9b8k9gYLhbSS8gsLHGJe5ysYw',
    authDomain: 'geller-map.firebaseapp.com',
    projectId: 'geller-map',
    storageBucket: 'geller-map.firebasestorage.app',
    messagingSenderId: '870264090360',
    appId: '1:870264090360:web:13b5a5f1ca98bebe04150d',
    measurementId: 'G-SBE5M4JGSQ'
  }
};
```

**Collections**:
- `mindmaps` - Map metadata (name, owner, settings, timestamps)
- `mindmapNodes` - All nodes with `mapId` reference (flat structure for querying)

**Security Rules** (replace default in `firestore.rules`):
```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Mind Maps
    match /mindmaps/{mapId} {
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
      allow read, update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
    }

    // Mind Map Nodes
    match /mindmapNodes/{nodeId} {
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
      allow read, update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
    }
  }
}
```

### Data Model

```typescript
// Mind Map (Document in `mindmaps` collection)
export interface MindMap {
  id: string;
  userId: string;
  name: string;
  description?: string;
  rootNodeId: string;
  settings: {
    theme: 'light' | 'dark' | 'system';
    layoutMode: 'freeform' | 'auto';
    defaultNodeColor?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Mind Map Node (Document in `mindmapNodes` collection)
export interface MindMapNode {
  id: string;
  userId: string;
  mapId: string; // Reference to parent MindMap
  parentId: string | null; // null for root node
  text: string;
  position: { x: number; y: number };
  style?: {
    color?: string;
    shape?: 'rounded' | 'square' | 'circle';
    fontFamily?: string;
    icon?: string;
  };
  task?: {
    dueDate?: Date;
    priority?: 'low' | 'medium' | 'high';
    isComplete?: boolean;
  };
  attachments?: Array<{ type: 'image' | 'link' | 'file'; url: string }>;
  isExpanded?: boolean;
  childrenIds?: string[];
  order: number; // For sibling ordering
  createdAt: Date;
  updatedAt: Date;
}

// Local State (in MindMapStore)
export interface MindMapState {
  currentMap: MindMap | null;
  nodes: Record<string, MindMapNode>;
  selectedNodeId: string | null;
  history: {
    past: MindMapAction[];
    future: MindMapAction[];
  };
  view: {
    scale: number;
    panX: number;
    panY: number;
  };
}
```

## Implementation Roadmap

### Phase 1: Foundation & Canvas (Current)

- [ ] **Setup**: Angular Material, CDK, Theme.
- [ ] **Firebase**: Create environment files, install `@angular/fire`, configure providers.
- [ ] **Auth**: Copy/adapt `AuthService` from geller-tasks (Google Sign-In).
- [ ] **Core Services**: Create `DbService`, `LoggingService`.
- [ ] **Store**: `MindMapStore` with basic Actions and State.
- [ ] **Canvas**: Infinite Pan/Zoom implementation using CSS Transforms.

### Phase 2: Core Node Interaction

- [ ] **Node Rendering**: Basic `NodeComponent` with Text.
- [ ] **Connections**: SVG Bezier curves linking nodes.
- [ ] **Manipulation**: Drag & Drop (CDK), Add Child/Sibling.
- [ ] **Selection**: Click to select, Double-click to edit.

### Phase 3: Enhanced Features

- [ ] **Styling**: Node color/shape picker.
- [ ] **Undo/Redo**: Implement History service/logic in Store.
- [ ] **Persistence**: Firestore sync via `MindMapService`.
- [ ] **Export**: Basic Image/JSON export.

### Phase 4: Productivity & Polish

- [ ] **Task Metadata**: Add Datepicker/Checkbox to nodes.
- [ ] **Outline View**: Alternative list rendering of the map.
- [ ] **Focus Mode**: CSS class toggling for branch isolation.

### Phase 5: Cloud & Collaboration (Future Pivot)

- [ ] **Real-time Sync**: Firestore listeners for live updates.
- [ ] **Sharing**: Generate share links with permissions.
- [ ] **Multi-user**: Conflict resolution for concurrent edits.
