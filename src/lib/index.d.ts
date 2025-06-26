import React from 'react';

// VideoEditor component props
export interface VideoEditorProps {
	initialTracks?: Track[];
	onExport?: (videoBlob: Blob) => void;
	onTimeUpdate?: (time: number) => void;
	onDurationChange?: (duration: number) => void;
	onPlayPause?: (isPlaying: boolean) => void;
	onSeek?: (time: number) => void;
	onClipUpdate?: (trackId: string, clipId: string, updates: any) => void;
	onClipMove?: (trackId: string, clipId: string, newStartTime: number) => void;
	onClipTrim?: (trackId: string, clipId: string, trimStart: number, trimEnd: number) => void;
	onClipCrop?: (trackId: string, clipId: string, crop: any) => void;
	onPositionChange?: (trackId: string, clipId: string, position: any) => void;
	onScaleChange?: (trackId: string, clipId: string, scale: any) => void;
	onCutClip?: (trackId: string, clipId: string) => void;
	onAddClip?: (trackId: string, clipData: any) => void;
	onAddClipFromFile?: (trackId: string, file: File) => void;
	onPropertyChange?: (property: string, value: any) => void;
	onAddTrack?: (type: 'video' | 'audio') => void;
	onReorderTracks?: (fromIndex: number, toIndex: number) => void;
	onDeleteClip?: (trackId: string, clipId: string) => void;
	onDeleteTrack?: (trackId: string) => void;
	onZoomChange?: (newZoom: number) => void;
	onExport?: () => void;
	onDebugExport?: () => void;
	onStartRecording?: () => void;
	onStop?: () => void;
	onStopRecording?: () => void;
}

// Track interface
export interface Track {
	id: string;
	type: 'video' | 'audio';
	name: string;
	clips: Clip[];
}

// Clip interface
export interface Clip {
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

// Main VideoEditor component
export const VideoEditor: React.FC<VideoEditorProps>;

// VideoPlayer component
export const VideoPlayer: React.FC<any>;

// TimelineEditor component
export const TimelineEditor: React.FC<any>;

// Utility functions
export function getTimelineDuration(tracks: Track[]): number;
export function getTrackLastEnd(track: Track): number;
export function checkForOverlaps(track: Track, clipId: string, newStartTime: number, duration: number): boolean;
export function processVideoFile(file: File): Promise<any>;
export function processAudioFile(file: File): Promise<any>;
export function exportVideo(tracks: Track[], options?: any): Promise<Blob>;
export function downloadVideo(videoBlob: Blob, filename?: string): void;
export function simpleExportVideo(tracks: Track[], options?: any): Promise<Blob>;
export function exportAllIntermediateFiles(tracks: Track[], options?: any): Promise<any>;
export function logVisibleClipSections(tracks: Track[], currentTime: number, duration: number): void;
export function extractAudioFromVideo(videoFile: File): Promise<Blob>;

// Default export
export default VideoEditor; 