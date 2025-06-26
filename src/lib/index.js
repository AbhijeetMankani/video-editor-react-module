// Main module entry point for video-editor-ai
export { default as VideoEditor } from "../components/VideoEditor";
export { default as VideoPlayer } from "../components/VideoPlayer";
export { default as TimelineEditor } from "../components/TimelineEditor";

// Export utility functions
export { getTimelineDuration } from "../utils/getTimelineDuration";
export { getTrackLastEnd } from "../utils/getTrackLastEnd";
export { checkForOverlaps } from "../utils/checkForOverlaps";
export { processVideoFile, processAudioFile } from "../utils/fileUploadUtils";
export {
	exportVideo,
	downloadVideo,
	simpleExportVideo,
	exportAllIntermediateFiles,
	logVisibleClipSections,
	extractAudioFromVideo,
} from "../utils/ffmpegUtils";

// Export default as VideoEditor for backward compatibility
import VideoEditor from "../components/VideoEditor";
export default VideoEditor;
