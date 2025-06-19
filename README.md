# Video Editor AI

A React-based video editor with timeline editing, drag-and-drop functionality, and real-time preview capabilities.

## Features

-   **Video Player**: Canvas-based video rendering with real-time preview
-   **Timeline Editor**: Multi-track timeline with drag-and-drop functionality
-   **Clip Management**: Add, move, trim, and crop video/audio clips
-   **Parallel Editing**: Edit multiple video and audio tracks simultaneously
-   **Real-time Controls**: Play/pause, seeking, zoom controls
-   **Clip Properties**: Adjust start time, duration, crop, and volume

## Getting Started

### Prerequisites

-   Node.js (version 14 or higher)
-   npm or yarn

### Installation

1. Clone the repository:

```bash
git clone https://github.com/AbhijeetMankani/video-editor-react
cd video-editor-ai
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## Usage

### Basic Operations

1. **Play/Pause**: Click the play/pause button in the header or player controls
2. **Seek**: Click anywhere on the timeline to jump to that time
3. **Zoom**: Use the zoom controls (+/-) to adjust timeline zoom level

### Timeline Editing

1. **Add Tracks**: Click "Add Video Track" or "Add Audio Track" buttons
2. **Add Clips**: Click the "+" button on any track to add a sample clip
3. **Move Clips**: Click and drag clips to reposition them on the timeline
4. **Trim Clips**: Drag the resize handles on clip edges to trim
5. **Select Clips**: Click on any clip to select it and view properties

### Clip Properties

When a clip is selected, you can adjust:

-   **Start Time**: When the clip begins on the timeline
-   **Duration**: How long the clip plays
-   **Crop** (video only): X, Y, width, and height crop values
-   **Volume** (audio only): Audio volume level

## Project Structure

```
video-editor-ai/
├── public/
│   ├── index.html
│   ├── manifest.json
│   └── robots.txt
├── src/
│   ├── components/
│   │   ├── VideoEditor.jsx
│   │   ├── VideoEditor.css
│   │   ├── VideoPlayer.jsx
│   │   ├── VideoPlayer.css
│   │   ├── TimelineEditor.jsx
│   │   └── TimelineEditor.css
│   ├── App.jsx
│   ├── App.css
│   ├── index.js
│   ├── index.css
│   └── reportWebVitals.js
├── package.json
└── README.md
```
