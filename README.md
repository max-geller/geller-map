# Geller Map

A modern, collaborative mind-mapping application built with Angular 20 and Material Design 3.

## Features

- **Infinite Canvas**: Pan and zoom with smooth controls
- **Drag & Drop Nodes**: Intuitive node positioning
- **Keyboard Shortcuts**: Tab (new child), Enter (new sibling), Delete, Ctrl+Z (undo)
- **Material Design 3**: Beautiful, modern UI with dark mode support
- **Cloud Sync**: Data persisted to Firebase Firestore
- **Google Authentication**: Secure sign-in with Google

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Firebase account

### Firebase Setup

1. Go to the [Firebase Console](https://console.firebase.google.com/project/geller-map)
2. Enable **Authentication**:
   - Navigate to Authentication > Sign-in method
   - Enable **Google** as a sign-in provider
   - Add your domain to authorized domains (for local dev, add `localhost`)
3. Enable **Firestore Database** (already done if you ran `firebase init`)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

### Running Locally

```bash
npm start
```

Open [http://localhost:4200](http://localhost:4200) in your browser.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Tab | Add child node |
| Enter | Add sibling node |
| Delete/Backspace | Delete selected node |
| F2 | Edit selected node |
| Ctrl+Z | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Redo |
| Mouse wheel | Zoom in/out |
| Click + Drag (on canvas) | Pan |

## Project Structure

```
src/app/
├── core/
│   ├── guards/        # Route guards
│   ├── models/        # TypeScript interfaces
│   └── services/      # Core services (Auth, DB, MindMap)
├── features/
│   ├── auth/          # Login page
│   ├── canvas/        # Canvas & connection components
│   ├── dashboard/     # Map list page
│   ├── editor/        # Map editor page
│   └── node/          # Node component
└── store/             # MindMapStore (Signal-based state)
```

## Technologies

- **Angular 20** with Zoneless change detection
- **Angular Material 20** with Material Design 3
- **Firebase** (Firestore + Authentication)
- **Angular CDK** for drag & drop

## License

Private - All rights reserved.
