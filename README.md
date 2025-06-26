# React Video Editor

A powerful React-based video editor component with timeline editing, FFmpeg integration, and AI-powered features.

## Features

-   🎬 **Timeline-based video editing** with multiple tracks
-   ✂️ **Advanced editing tools**: cut, crop, scale, move clips
-   🎤 **Audio recording** capabilities
-   📁 **File upload** support for video and audio files
-   🎯 **FFmpeg integration** for video processing
-   🎨 **Modern UI** with intuitive controls
-   📱 **Responsive design** for various screen sizes

## Installation

## Quick Start

```jsx
import React from "react";
import { VideoEditor } from "video-editor-react";

function App() {
	const handleExport = (videoBlob) => {
		// Handle the exported video blob
		const url = URL.createObjectURL(videoBlob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "edited-video.mp4";
		a.click();
	};

	return (
		<div>
			<VideoEditor
				onExport={handleExport}
				initialTracks={[
					{
						id: "video-1",
						type: "video",
						name: "Video Track 1",
						clips: [],
					},
					{
						id: "audio-1",
						type: "audio",
						name: "Audio Track 1",
						clips: [],
					},
				]}
			/>
		</div>
	);
}
```

## API Reference

### VideoEditor Props

| Prop               | Type                           | Description                              |
| ------------------ | ------------------------------ | ---------------------------------------- |
| `initialTracks`    | `Track[]`                      | Initial tracks configuration             |
| `onExport`         | `(videoBlob: Blob) => void`    | Callback when video is exported          |
| `onTimeUpdate`     | `(time: number) => void`       | Callback when playback time changes      |
| `onDurationChange` | `(duration: number) => void`   | Callback when video duration changes     |
| `onPlayPause`      | `(isPlaying: boolean) => void` | Callback when play/pause state changes   |
| `onSeek`           | `(time: number) => void`       | Callback when seeking to a specific time |

### Track Interface

```typescript
interface Track {
	id: string;
	type: "video" | "audio";
	name: string;
	clips: Clip[];
}
```

### Clip Interface

```typescript
interface Clip {
	id: string;
	name: string;
	startTime: number;
	duration: number;
	trimStart?: number;
	trimEnd?: number;
	crop?: any;
	position?: any;
	scale?: any;
	file?: File;
	url?: string;
}
```

## Available Tools

The video editor includes several editing tools:

-   **Select** 👆 - Select and move clips
-   **Crop** ✂️ - Crop video clips
-   **Scale** 🔍 - Scale video clips
-   **Move** ✋ - Move clips on timeline
-   **Cut** 🔪 - Cut clips at timeline position
-   **Record** 🎤 - Record audio

## Utility Functions

The module also exports utility functions for advanced usage:

```jsx
import {
	getTimelineDuration,
	getTrackLastEnd,
	checkForOverlaps,
	processVideoFile,
	processAudioFile,
	exportVideo,
	downloadVideo,
	simpleExportVideo,
	exportAllIntermediateFiles,
	logVisibleClipSections,
	extractAudioFromVideo,
} from "video-editor-ai";
```

### Utility Functions Reference

| Function                                                  | Description                                  |
| --------------------------------------------------------- | -------------------------------------------- |
| `getTimelineDuration(tracks)`                             | Calculate total timeline duration            |
| `getTrackLastEnd(track)`                                  | Get the end time of the last clip in a track |
| `checkForOverlaps(track, clipId, newStartTime, duration)` | Check if moving a clip would cause overlaps  |
| `processVideoFile(file)`                                  | Process uploaded video file                  |
| `processAudioFile(file)`                                  | Process uploaded audio file                  |
| `exportVideo(tracks, options)`                            | Export video with FFmpeg                     |
| `downloadVideo(videoBlob, filename)`                      | Download video blob as file                  |
| `simpleExportVideo(tracks, options)`                      | Simple video export                          |
| `extractAudioFromVideo(videoFile)`                        | Extract audio from video file                |

## Advanced Usage

### Custom Event Handlers

```jsx
<VideoEditor
	onClipUpdate={(trackId, clipId, updates) => {
		console.log("Clip updated:", { trackId, clipId, updates });
	}}
	onClipMove={(trackId, clipId, newStartTime) => {
		console.log("Clip moved:", { trackId, clipId, newStartTime });
	}}
	onClipTrim={(trackId, clipId, trimStart, trimEnd) => {
		console.log("Clip trimmed:", { trackId, clipId, trimStart, trimEnd });
	}}
	onAddTrack={(type) => {
		console.log("Track added:", type);
	}}
	onDeleteTrack={(trackId) => {
		console.log("Track deleted:", trackId);
	}}
/>
```

### Custom Initial Configuration

```jsx
const initialTracks = [
	{
		id: "video-1",
		type: "video",
		name: "Main Video",
		clips: [
			{
				id: "clip-1",
				name: "Sample Video",
				startTime: 0,
				duration: 10,
				url: "https://example.com/sample-video.mp4",
			},
		],
	},
	{
		id: "audio-1",
		type: "audio",
		name: "Background Music",
		clips: [],
	},
];

<VideoEditor initialTracks={initialTracks} />;
```

## Dependencies

This module requires the following peer dependencies:

-   `react` >= 16.8.0
-   `react-dom` >= 16.8.0

And includes these dependencies:

-   `@ffmpeg/ffmpeg` - For video processing
-   `@ffmpeg/util` - FFmpeg utilities

## Browser Support

-   Chrome >= 88
-   Firefox >= 85
-   Safari >= 14
-   Edge >= 88

## Development

To run the development server:

```bash
npm run dev
```

To build the module:

```bash
npm run build:lib
```

To run tests:

```bash
npm test
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
