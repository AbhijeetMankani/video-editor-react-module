import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Main module entry point
export { default as VideoEditor } from "./components/VideoEditor";
export { default as VideoPlayer } from "./components/VideoPlayer";
export { default as TimelineEditor } from "./components/TimelineEditor";

// Export utility functions
export { getTimelineDuration } from "./utils/getTimelineDuration";
export { getTrackLastEnd } from "./utils/getTrackLastEnd";
export { checkForOverlaps } from "./utils/checkForOverlaps";
export { processVideoFile, processAudioFile } from "./utils/fileUploadUtils";
export {
	exportVideo,
	downloadVideo,
	simpleExportVideo,
	exportAllIntermediateFiles,
	logVisibleClipSections,
	extractAudioFromVideo,
} from "./utils/ffmpegUtils";

// Export default as VideoEditor for backward compatibility
import VideoEditor from "./components/VideoEditor";
export default VideoEditor;
