import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";

let ffmpeg = null;

export const initFFmpeg = async () => {
	if (ffmpeg) return ffmpeg;

	ffmpeg = new FFmpeg();

	// Load FFmpeg WASM
	await ffmpeg.load({
		coreURL: await toBlobURL("/ffmpeg-core.js", "text/javascript"),
		wasmURL: await toBlobURL("/ffmpeg-core.wasm", "application/wasm"),
	});

	return ffmpeg;
};

export const processVideoFile = async (file) => {
	try {
		const ffmpegInstance = await initFFmpeg();

		// Write the uploaded file to FFmpeg's virtual filesystem
		await ffmpegInstance.writeFile("input.mp4", await fetchFile(file));

		// Get video information
		await ffmpegInstance.exec(["-i", "input.mp4", "-f", "null", "-"]);

		// Read the processed file
		const data = await ffmpegInstance.readFile("input.mp4");

		// Create a blob URL for the processed video
		const blob = new Blob([data], { type: file.type });
		const url = URL.createObjectURL(blob);

		return {
			url,
			duration: await getVideoDuration(ffmpegInstance, "input.mp4"),
			originalFile: file,
		};
	} catch (error) {
		console.error("Error processing video file:", error);
		throw error;
	}
};

export const processAudioFile = async (file) => {
	try {
		const ffmpegInstance = await initFFmpeg();

		// Write the uploaded file to FFmpeg's virtual filesystem
		await ffmpegInstance.writeFile("input.mp3", await fetchFile(file));

		// Get audio information
		await ffmpegInstance.exec(["-i", "input.mp3", "-f", "null", "-"]);

		// Read the processed file
		const data = await ffmpegInstance.readFile("input.mp3");

		// Create a blob URL for the processed audio
		const blob = new Blob([data], { type: file.type });
		const url = URL.createObjectURL(blob);

		return {
			url,
			duration: await getAudioDuration(ffmpegInstance, "input.mp3"),
			originalFile: file,
		};
	} catch (error) {
		console.error("Error processing audio file:", error);
		throw error;
	}
};

export const createFileInput = (accept, onFileSelect) => {
	const input = document.createElement("input");
	input.type = "file";
	input.accept = accept;
	input.style.display = "none";

	input.addEventListener("change", (e) => {
		const file = e.target.files[0];
		if (file) {
			onFileSelect(file);
		}
		// Clean up
		document.body.removeChild(input);
	});

	document.body.appendChild(input);
	input.click();
};

// Helper function to export intermediate files for debugging
const exportIntermediateFile = async (
	ffmpegInstance,
	filename,
	displayName
) => {
	try {
		const data = await ffmpegInstance.readFile(filename);
		const blob = new Blob([data], { type: "video/mp4" });
		const url = URL.createObjectURL(blob);

		// Create download link
		const a = document.createElement("a");
		a.href = url;
		a.download = `${displayName}.mp4`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);

		console.log(`Exported intermediate file: ${displayName}.mp4`);
	} catch (error) {
		console.error(`Failed to export ${displayName}:`, error);
	}
};

// Function to list all files in FFmpeg filesystem for debugging
const listFFmpegFiles = async (ffmpegInstance) => {
	try {
		const files = await ffmpegInstance.listDir("/");
		console.log("Files in FFmpeg filesystem:", files);
		return files;
	} catch (error) {
		console.error("Error listing FFmpeg files:", error);
		return [];
	}
};

// New export functionality
export const exportVideo = async (tracks, duration, onProgress) => {
	try {
		const ffmpegInstance = await initFFmpeg();

		const visibleSections = getVisibleClipSections(tracks);
		const timelineDuration = duration;
		const width = 1280;
		const height = 720;

		// Sort all visible sections by their visibleStart
		const sortedSections = [...visibleSections].sort(
			(a, b) => a.visibleStart - b.visibleStart
		);

		// Build a list of all segments (black or video) covering the whole timeline
		let segments = [];
		let currentTime = 0;
		let segmentIndex = 0;
		for (const section of sortedSections) {
			if (section.visibleStart > currentTime) {
				// Gap: create black video segment
				const gapDuration = section.visibleStart - currentTime;
				const blackName = `black_${segmentIndex}.mp4`;
				await createBlackVideoSegment(
					ffmpegInstance,
					blackName,
					gapDuration,
					width,
					height
				);
				segments.push({ type: "black", filename: blackName });
				segmentIndex++;
			}

			// Video section: trim from source
			const { clip, trimStart, visibleEnd, visibleStart } = section;
			const segDuration = visibleEnd - visibleStart;
			const inputName = `clip_${clip.id}.mp4`;
			// Write file if not already written
			if (
				!(await ffmpegInstance.listDir("/")).some(
					(f) => f.name === inputName
				)
			) {
				const fileData = await fetchFile(clip.originalFile);
				await ffmpegInstance.writeFile(inputName, fileData);
			}
			const outName = `section_${segmentIndex}.mp4`;
			await ffmpegInstance.exec([
				"-ss",
				trimStart.toString(),
				"-i",
				inputName,
				"-t",
				segDuration.toString(),
				"-c:v",
				"libx264",
				"-an",
				"-preset",
				"ultrafast",
				"-pix_fmt",
				"yuv420p",
				outName,
			]);
			segments.push({ type: "video", filename: outName });
			segmentIndex++;
			currentTime = section.visibleEnd;
		}
		// If there's a gap at the end
		if (currentTime < timelineDuration) {
			const gapDuration = timelineDuration - currentTime;
			const blackName = `black_${segmentIndex}.mp4`;
			await createBlackVideoSegment(
				ffmpegInstance,
				blackName,
				gapDuration,
				width,
				height
			);
			segments.push({ type: "black", filename: blackName });
		}

		// Create concat list file for video
		const concatList = segments
			.map((s) => `file '${s.filename}'`)
			.join("\n");
		await ffmpegInstance.writeFile("concat_list.txt", concatList);

		if (onProgress) onProgress(0.7, "Processing audio tracks...");

		// --- AUDIO MIXING ---
		const audioTracks = tracks.filter((t) => t.type === "audio");
		let audioInputs = [];
		let audioFilters = [];
		let amixInputs = [];
		let audioIndex = 0;
		for (const track of audioTracks) {
			for (const clip of track.clips) {
				if (!clip.source || clip.muted) continue;
				const inputName = `audio_${clip.id}.mp3`;
				// Write file if not already written
				if (
					!(await ffmpegInstance.listDir("/")).some(
						(f) => f.name === inputName
					)
				) {
					const fileData = await fetchFile(clip.originalFile);
					await ffmpegInstance.writeFile(inputName, fileData);
					console.log(
						`[Audio Export] Wrote audio file: ${inputName}`
					);
				}
				// Trim and position audio
				const trimmedName = `audio_trimmed_${clip.id}.mp3`;
				console.log(
					`[Audio Export] Trimming and delaying audio: ${inputName} -> ${trimmedName} (startTime: ${clip.startTime}, duration: ${clip.duration}, volume: ${clip.volume})`
				);
				await ffmpegInstance.exec([
					"-ss",
					(clip.trimStart || 0).toString(),
					"-i",
					inputName,
					"-t",
					(clip.duration || 1).toString(),
					"-af",
					`adelay=${(clip.startTime * 1000) | 0}|${
						(clip.startTime * 1000) | 0
					}${
						clip.volume !== undefined
							? `,volume=${clip.volume}`
							: ""
					}`,
					trimmedName,
				]);
				console.log(`[Audio Export] Finished trimming: ${trimmedName}`);
				audioInputs.push(trimmedName);
				amixInputs.push(`[${audioIndex}:a]`);
				audioIndex++;
			}
		}

		let finalAudioName = null;
		if (audioInputs.length > 0) {
			// Build ffmpeg command to mix all audio
			const mixOutput = "mixed_audio.mp3";
			console.log(
				`[Audio Export] Mixing ${audioInputs.length} audio tracks into ${mixOutput}`
			);
			await ffmpegInstance.exec([
				...audioInputs.flatMap((name) => ["-i", name]),
				"-filter_complex",
				`${amixInputs.join("")}amix=inputs=${
					audioInputs.length
				}:duration=longest:dropout_transition=0[aout]` +
					(amixInputs.length > 0 ? ";[aout]volume=1[aout2]" : ""),
				"-map",
				"0:v?",
				"-map",
				"[aout2]",
				"-y",
				mixOutput,
			]);
			console.log(
				`[Audio Export] Finished mixing audio. Output: ${mixOutput}`
			);
			finalAudioName = mixOutput;
			console.log(
				`[Audio Export] Final audio file for muxing: ${finalAudioName}`
			);
		}

		if (onProgress) onProgress(0.8, "Concatenating segments...");

		const outputName = "output.mp4";
		// Combine video and audio
		if (finalAudioName) {
			await ffmpegInstance.exec([
				"-f",
				"concat",
				"-safe",
				"0",
				"-i",
				"concat_list.txt",
				"-i",
				finalAudioName,
				"-c:v",
				"copy",
				"-c:a",
				"aac",
				outputName,
			]);
		} else {
			await ffmpegInstance.exec([
				"-f",
				"concat",
				"-safe",
				"0",
				"-i",
				"concat_list.txt",
				"-c",
				"copy",
				outputName,
			]);
		}

		if (onProgress) onProgress(0.95, "Finalizing...");

		// Read the output file
		const data = await ffmpegInstance.readFile(outputName);
		const blob = new Blob([data], { type: "video/mp4" });
		const url = URL.createObjectURL(blob);

		if (onProgress) onProgress(1.0, "Export complete!");

		return { url, blob };
	} catch (error) {
		console.error("Error in exportVideo:", error);
		throw error;
	}
};

export const simpleExportVideo = async () => {
	throw new Error("simpleExportVideo is not implemented.");
};

// Function to export all intermediate files at once
export const exportAllIntermediateFiles = async (ffmpegInstance) => {
	try {
		console.log("Exporting all intermediate files...");

		const files = await listFFmpegFiles(ffmpegInstance);

		for (const file of files) {
			// if (
			// 	file.isFile &&
			// 	(file.name.endsWith(".mp4") || file.name.endsWith(".webm"))
			// ) {
			try {
				await exportIntermediateFile(
					ffmpegInstance,
					file.name,
					`debug_${file.name}`
				);
			} catch (error) {
				console.error(`Failed to export ${file.name}:`, error);
			}
			// }
		}

		console.log("Finished exporting all intermediate files");
	} catch (error) {
		console.error("Error exporting all intermediate files:", error);
	}
};

// Helper function to trigger download
export const downloadVideo = (blob, filename = "exported-video.mp4") => {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
};

// Helper functions for getting duration
export const getVideoDuration = async (ffmpegInstance, filename) => {
	try {
		// Get video information
		await ffmpegInstance.exec(["-i", filename, "-f", "null", "-"]);

		// For now, return a default duration since getting exact duration from FFmpeg output is complex
		// In a real implementation, you'd parse the FFmpeg output to get the actual duration
		return 10.0; // Default 10 seconds
	} catch (error) {
		console.error("Error getting video duration:", error);
		return 10.0; // Default fallback
	}
};

export const getAudioDuration = async (ffmpegInstance, filename) => {
	try {
		// Get audio information
		await ffmpegInstance.exec(["-i", filename, "-f", "null", "-"]);

		// For now, return a default duration since getting exact duration from FFmpeg output is complex
		// In a real implementation, you'd parse the FFmpeg output to get the actual duration
		return 10.0; // Default 10 seconds
	} catch (error) {
		console.error("Error getting audio duration:", error);
		return 10.0; // Default fallback
	}
};

// Utility to get visible (non-overlapped) sections of video clips
// Returns an array of { clip, visibleStart, visibleEnd, trimStart, trimEnd, trackIndex }
export function getVisibleClipSections(tracks) {
	// Only consider video tracks, from top (highest index) to bottom (lowest index)
	const videoTracks = tracks.filter((t) => t.type === "video");
	const result = [];

	// Build a list of intervals for each track, top to bottom
	for (let tIdx = 0; tIdx < videoTracks.length; tIdx++) {
		const track = videoTracks[tIdx];
		for (const clip of track.clips) {
			const clipStart = clip.startTime;
			const clipEnd = clip.startTime + clip.duration;

			// Find all intervals in higher tracks that overlap this clip
			let coveredIntervals = [];
			for (let higherIdx = 0; higherIdx < tIdx; higherIdx++) {
				const higherTrack = videoTracks[higherIdx];
				for (const higherClip of higherTrack.clips) {
					const hStart = higherClip.startTime;
					const hEnd = higherClip.startTime + higherClip.duration;
					// If overlaps
					if (hEnd > clipStart && hStart < clipEnd) {
						coveredIntervals.push([
							Math.max(hStart, clipStart),
							Math.min(hEnd, clipEnd),
						]);
					}
				}
			}

			// Merge covered intervals
			coveredIntervals.sort((a, b) => a[0] - b[0]);
			const merged = [];
			for (const interval of coveredIntervals) {
				if (
					!merged.length ||
					interval[0] > merged[merged.length - 1][1]
				) {
					merged.push([...interval]);
				} else {
					merged[merged.length - 1][1] = Math.max(
						merged[merged.length - 1][1],
						interval[1]
					);
				}
			}

			// Find visible intervals (gaps between merged covered intervals)
			let prev = clipStart;
			for (const [covStart, covEnd] of merged) {
				if (covStart > prev) {
					// Visible section before this covered interval
					const visibleStart = prev;
					const visibleEnd = covStart;
					// Calculate trimStart/trimEnd relative to original clip
					const trimStart =
						(clip.trimStart || 0) + (visibleStart - clipStart);
					const trimEnd = trimStart + (visibleEnd - visibleStart);
					result.push({
						clip,
						visibleStart,
						visibleEnd,
						trimStart,
						trimEnd,
						trackIndex: tIdx,
					});
				}
				prev = Math.max(prev, covEnd);
			}
			// Any visible section after last covered interval
			if (prev < clipEnd) {
				const visibleStart = prev;
				const visibleEnd = clipEnd;
				const trimStart =
					(clip.trimStart || 0) + (visibleStart - clipStart);
				const trimEnd = trimStart + (visibleEnd - visibleStart);
				result.push({
					clip,
					visibleStart,
					visibleEnd,
					trimStart,
					trimEnd,
					trackIndex: tIdx,
				});
			}
		}
	}
	return result;
}

// Debug utility: log visible clip sections
export function logVisibleClipSections(tracks) {
	const visibleSections = getVisibleClipSections(tracks);
	console.log("Visible Clip Sections:", visibleSections);
	return visibleSections;
}

// Helper: create a black video segment
export async function createBlackVideoSegment(
	ffmpegInstance,
	outputName,
	duration,
	width = 1280,
	height = 720
) {
	await ffmpegInstance.exec([
		"-f",
		"lavfi",
		"-i",
		`color=c=black:s=${width}x${height}:d=${duration}`,
		"-c:v",
		"libx264",
		"-t",
		duration.toString(),
		"-pix_fmt",
		"yuv420p",
		outputName,
	]);
}

// Extract audio from a video file using ffmpeg
export const extractAudioFromVideo = async (file, outputExt = "mp3") => {
	const ffmpegInstance = await initFFmpeg();
	const inputName = "input_extract_audio.mp4";
	const outputName = `output_audio.${outputExt}`;
	await ffmpegInstance.writeFile(inputName, await fetchFile(file));
	await ffmpegInstance.exec([
		"-i",
		inputName,
		"-vn", // no video
		"-acodec",
		"libmp3lame",
		outputName,
	]);
	const data = await ffmpegInstance.readFile(outputName);
	const blob = new Blob([data], { type: "audio/mpeg" });
	const url = URL.createObjectURL(blob);
	return { blob, url, name: file.name.replace(/\.[^/.]+$/, "") + ".mp3" };
};
