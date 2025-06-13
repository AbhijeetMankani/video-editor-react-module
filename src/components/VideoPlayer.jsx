import React, { forwardRef, useEffect, useRef, useState } from "react";
import "./VideoPlayer.css";

const VideoPlayer = forwardRef(
	(
		{
			tracks,
			currentTime,
			isPlaying,
			duration,
			selectedClip,
			onTimeUpdate,
			onDurationChange,
			onPlayPause,
			onCropChange,
		},
		ref
	) => {
		const canvasRef = useRef(null);
		const videoElementsRef = useRef({});
		const audioElementsRef = useRef({});
		const [playbackSpeed, setPlaybackSpeed] = useState(1); // Local state for playback speed
		const [isDragging, setIsDragging] = useState(false);
		const [isResizing, setIsResizing] = useState(false);
		const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
		const [resizeHandle, setResizeHandle] = useState(null);
		const [originalCrop, setOriginalCrop] = useState(null);
		// const clipPlayingStateRef = useRef(new Map()); // Removed: ref to track individual clip playback state
		// const activeMediaElementRef = useRef(null); // Removed: New ref to track the currently active playing media element

		// Helper function to get canvas coordinates
		const getCanvasCoordinates = (clientX, clientY) => {
			const canvas = canvasRef.current;
			if (!canvas) return { x: 0, y: 0 };

			const rect = canvas.getBoundingClientRect();
			return {
				x: clientX - rect.left,
				y: clientY - rect.top,
			};
		};

		// Helper function to check if a point is in a resize handle
		const getResizeHandle = (x, y, crop) => {
			const handleSize = 10;
			const canvas = canvasRef.current;
			if (!canvas || !crop) return null;

			const canvasWidth = canvas.width;
			const canvasHeight = canvas.height;

			// Convert crop percentages to pixel coordinates
			const cropX = (crop.x / 100) * canvasWidth;
			const cropY = (crop.y / 100) * canvasHeight;
			const cropWidth = (crop.width / 100) * canvasWidth;
			const cropHeight = (crop.height / 100) * canvasHeight;

			// Check corners
			if (
				x >= cropX - handleSize &&
				x <= cropX + handleSize &&
				y >= cropY - handleSize &&
				y <= cropY + handleSize
			) {
				return "top-left";
			}
			if (
				x >= cropX + cropWidth - handleSize &&
				x <= cropX + cropWidth + handleSize &&
				y >= cropY - handleSize &&
				y <= cropY + handleSize
			) {
				return "top-right";
			}
			if (
				x >= cropX - handleSize &&
				x <= cropX + handleSize &&
				y >= cropY + cropHeight - handleSize &&
				y <= cropY + cropHeight + handleSize
			) {
				return "bottom-left";
			}
			if (
				x >= cropX + cropWidth - handleSize &&
				x <= cropX + cropWidth + handleSize &&
				y >= cropY + cropHeight - handleSize &&
				y <= cropY + cropHeight + handleSize
			) {
				return "bottom-right";
			}

			// Check edges
			if (
				x >= cropX - handleSize &&
				x <= cropX + handleSize &&
				y >= cropY &&
				y <= cropY + cropHeight
			) {
				return "left";
			}
			if (
				x >= cropX + cropWidth - handleSize &&
				x <= cropX + cropWidth + handleSize &&
				y >= cropY &&
				y <= cropY + cropHeight
			) {
				return "right";
			}
			if (
				x >= cropX &&
				x <= cropX + cropWidth &&
				y >= cropY - handleSize &&
				y <= cropY + handleSize
			) {
				return "top";
			}
			if (
				x >= cropX &&
				x <= cropX + cropWidth &&
				y >= cropY + cropHeight - handleSize &&
				y <= cropY + cropHeight + handleSize
			) {
				return "bottom";
			}

			return null;
		};

		// Helper function to check if cursor is over the selected clip
		const isSelectedClipVisible = () => {
			if (!selectedClip) return false;

			const clip = tracks
				.flatMap((t) => t.clips)
				.find((c) => c.id === selectedClip.clipId);
			if (!clip) return false;

			return (
				currentTime >= clip.startTime &&
				currentTime < clip.startTime + clip.duration
			);
		};

		// Mouse event handlers
		const handleCanvasMouseDown = (e) => {
			if (!isSelectedClipVisible()) return;

			const clip = tracks
				.flatMap((t) => t.clips)
				.find((c) => c.id === selectedClip.clipId);
			if (!clip || !clip.crop) return;

			const coords = getCanvasCoordinates(e.clientX, e.clientY);
			const handle = getResizeHandle(coords.x, coords.y, clip.crop);

			if (handle) {
				// Start resizing
				setIsResizing(true);
				setResizeHandle(handle);
				setOriginalCrop({ ...clip.crop });
				setDragStart(coords);
			} else {
				// Check if clicking inside the crop area for dragging
				const canvas = canvasRef.current;
				const canvasWidth = canvas.width;
				const canvasHeight = canvas.height;

				const cropX = (clip.crop.x / 100) * canvasWidth;
				const cropY = (clip.crop.y / 100) * canvasHeight;
				const cropWidth = (clip.crop.width / 100) * canvasWidth;
				const cropHeight = (clip.crop.height / 100) * canvasHeight;

				if (
					coords.x >= cropX &&
					coords.x <= cropX + cropWidth &&
					coords.y >= cropY &&
					coords.y <= cropY + cropHeight
				) {
					setIsDragging(true);
					setDragStart(coords);
					setOriginalCrop({ ...clip.crop });
				}
			}
		};

		const handleCanvasMouseMove = (e) => {
			if (!isSelectedClipVisible()) return;

			const clip = tracks
				.flatMap((t) => t.clips)
				.find((c) => c.id === selectedClip.clipId);
			if (!clip || !clip.crop) return;

			const coords = getCanvasCoordinates(e.clientX, e.clientY);
			const canvas = canvasRef.current;
			const canvasWidth = canvas.width;
			const canvasHeight = canvas.height;

			if (isResizing && resizeHandle && originalCrop) {
				// Handle resizing
				const deltaX = coords.x - dragStart.x;
				const deltaY = coords.y - dragStart.y;

				let newCrop = { ...originalCrop };

				// Convert pixel deltas to percentage deltas
				const deltaXPercent = (deltaX / canvasWidth) * 100;
				const deltaYPercent = (deltaY / canvasHeight) * 100;

				switch (resizeHandle) {
					case "top-left":
						newCrop.x = Math.max(
							0,
							Math.min(
								originalCrop.x + originalCrop.width - 10,
								originalCrop.x + deltaXPercent
							)
						);
						newCrop.y = Math.max(
							0,
							Math.min(
								originalCrop.y + originalCrop.height - 10,
								originalCrop.y + deltaYPercent
							)
						);
						newCrop.width =
							originalCrop.width - (newCrop.x - originalCrop.x);
						newCrop.height =
							originalCrop.height - (newCrop.y - originalCrop.y);
						break;
					case "top-right":
						newCrop.y = Math.max(
							0,
							Math.min(
								originalCrop.y + originalCrop.height - 10,
								originalCrop.y + deltaYPercent
							)
						);
						newCrop.width = Math.max(
							10,
							originalCrop.width + deltaXPercent
						);
						newCrop.height =
							originalCrop.height - (newCrop.y - originalCrop.y);
						break;
					case "bottom-left":
						newCrop.x = Math.max(
							0,
							Math.min(
								originalCrop.x + originalCrop.width - 10,
								originalCrop.x + deltaXPercent
							)
						);
						newCrop.width =
							originalCrop.width - (newCrop.x - originalCrop.x);
						newCrop.height = Math.max(
							10,
							originalCrop.height + deltaYPercent
						);
						break;
					case "bottom-right":
						newCrop.width = Math.max(
							10,
							originalCrop.width + deltaXPercent
						);
						newCrop.height = Math.max(
							10,
							originalCrop.height + deltaYPercent
						);
						break;
					case "left":
						newCrop.x = Math.max(
							0,
							Math.min(
								originalCrop.x + originalCrop.width - 10,
								originalCrop.x + deltaXPercent
							)
						);
						newCrop.width =
							originalCrop.width - (newCrop.x - originalCrop.x);
						break;
					case "right":
						newCrop.width = Math.max(
							10,
							originalCrop.width + deltaXPercent
						);
						break;
					case "top":
						newCrop.y = Math.max(
							0,
							Math.min(
								originalCrop.y + originalCrop.height - 10,
								originalCrop.y + deltaYPercent
							)
						);
						newCrop.height =
							originalCrop.height - (newCrop.y - originalCrop.y);
						break;
					case "bottom":
						newCrop.height = Math.max(
							10,
							originalCrop.height + deltaYPercent
						);
						break;
				}

				// Update the clip's crop
				const track = tracks.find((t) =>
					t.clips.some((c) => c.id === selectedClip.clipId)
				);
				if (track && onCropChange) {
					onCropChange(
						selectedClip.trackId,
						selectedClip.clipId,
						newCrop
					);
				}
			} else if (isDragging && originalCrop) {
				// Handle dragging
				const deltaX = coords.x - dragStart.x;
				const deltaY = coords.y - dragStart.y;

				const deltaXPercent = (deltaX / canvasWidth) * 100;
				const deltaYPercent = (deltaY / canvasHeight) * 100;

				const newCrop = {
					x: Math.max(
						0,
						Math.min(
							100 - originalCrop.width,
							originalCrop.x + deltaXPercent
						)
					),
					y: Math.max(
						0,
						Math.min(
							100 - originalCrop.height,
							originalCrop.y + deltaYPercent
						)
					),
					width: originalCrop.width,
					height: originalCrop.height,
				};

				// Update the clip's crop
				const track = tracks.find((t) =>
					t.clips.some((c) => c.id === selectedClip.clipId)
				);
				if (track && onCropChange) {
					onCropChange(
						selectedClip.trackId,
						selectedClip.clipId,
						newCrop
					);
				}
			}
		};

		const handleCanvasMouseUp = () => {
			setIsDragging(false);
			setIsResizing(false);
			setResizeHandle(null);
			setOriginalCrop(null);
		};

		// Add global mouse event listeners
		useEffect(() => {
			const handleGlobalMouseUp = () => {
				if (isDragging || isResizing) {
					setIsDragging(false);
					setIsResizing(false);
					setResizeHandle(null);
					setOriginalCrop(null);
				}
			};

			const handleGlobalMouseMove = (e) => {
				if (isDragging || isResizing) {
					handleCanvasMouseMove(e);
				}
			};

			document.addEventListener("mouseup", handleGlobalMouseUp);
			document.addEventListener("mousemove", handleGlobalMouseMove);

			return () => {
				document.removeEventListener("mouseup", handleGlobalMouseUp);
				document.removeEventListener(
					"mousemove",
					handleGlobalMouseMove
				);
			};
		}, [
			isDragging,
			isResizing,
			selectedClip,
			tracks,
			currentTime,
			originalCrop,
			resizeHandle,
			dragStart,
		]);

		useEffect(() => {
			const canvas = canvasRef.current;
			const ctx = canvas.getContext("2d");

			if (!canvas || !ctx) return;

			const renderFrame = () => {
				// Clear canvas
				ctx.clearRect(0, 0, canvas.width, canvas.height);

				// Find the topmost video clip at the current time by checking tracks in order
				let topVideoClip = null;
				for (let i = 0; i < tracks.length; i++) {
					const track = tracks[i];
					if (track.type === "video") {
						const currentClip = track.clips.find(
							(clip) =>
								currentTime >= clip.startTime &&
								currentTime < clip.startTime + clip.duration
						);
						if (currentClip) {
							topVideoClip = {
								...currentClip,
								trackType: track.type,
							};
							break; // Found the topmost video clip
						}
					}
				}

				// Render the topmost video clip
				if (topVideoClip) {
					const videoElement =
						videoElementsRef.current[topVideoClip.id];

					if (videoElement && videoElement.readyState >= 2) {
						// Don't set currentTime here - it causes video seeking and black flashes
						// The video element will play continuously and stay in sync naturally

						// Apply crop transformation
						const crop = topVideoClip.crop || {
							x: 0,
							y: 0,
							width: 100,
							height: 100,
						};
						const sourceX =
							(videoElement.videoWidth * crop.x) / 100;
						const sourceY =
							(videoElement.videoHeight * crop.y) / 100;
						const sourceWidth =
							(videoElement.videoWidth * crop.width) / 100;
						const sourceHeight =
							(videoElement.videoHeight * crop.height) / 100;

						ctx.drawImage(
							videoElement,
							sourceX,
							sourceY,
							sourceWidth,
							sourceHeight,
							0,
							0,
							canvas.width,
							canvas.height
						);

						// Draw blue border if this clip is selected and currently playing
						if (
							selectedClip &&
							selectedClip.clipId === topVideoClip.id
						) {
							ctx.strokeStyle = "#007acc";
							ctx.lineWidth = 4;
							ctx.strokeRect(0, 0, canvas.width, canvas.height);
						}

						// Draw crop HUD if this clip is selected and visible
						if (
							selectedClip &&
							selectedClip.clipId === topVideoClip.id &&
							isSelectedClipVisible()
						) {
							const crop = topVideoClip.crop || {
								x: 0,
								y: 0,
								width: 100,
								height: 100,
							};

							// Convert crop percentages to pixel coordinates
							const cropX = (crop.x / 100) * canvas.width;
							const cropY = (crop.y / 100) * canvas.height;
							const cropWidth = (crop.width / 100) * canvas.width;
							const cropHeight =
								(crop.height / 100) * canvas.height;

							// Draw crop border
							ctx.strokeStyle = "#00ff00";
							ctx.lineWidth = 2;
							ctx.setLineDash([5, 5]);
							ctx.strokeRect(cropX, cropY, cropWidth, cropHeight);
							ctx.setLineDash([]);

							// Draw resize handles
							const handleSize = 6;
							ctx.fillStyle = "#00ff00";

							// Corner handles
							ctx.fillRect(
								cropX - handleSize / 2,
								cropY - handleSize / 2,
								handleSize,
								handleSize
							);
							ctx.fillRect(
								cropX + cropWidth - handleSize / 2,
								cropY - handleSize / 2,
								handleSize,
								handleSize
							);
							ctx.fillRect(
								cropX - handleSize / 2,
								cropY + cropHeight - handleSize / 2,
								handleSize,
								handleSize
							);
							ctx.fillRect(
								cropX + cropWidth - handleSize / 2,
								cropY + cropHeight - handleSize / 2,
								handleSize,
								handleSize
							);

							// Edge handles
							ctx.fillRect(
								cropX - handleSize / 2,
								cropY + cropHeight / 2 - handleSize / 2,
								handleSize,
								handleSize
							);
							ctx.fillRect(
								cropX + cropWidth - handleSize / 2,
								cropY + cropHeight / 2 - handleSize / 2,
								handleSize,
								handleSize
							);
							ctx.fillRect(
								cropX + cropWidth / 2 - handleSize / 2,
								cropY - handleSize / 2,
								handleSize,
								handleSize
							);
							ctx.fillRect(
								cropX + cropWidth / 2 - handleSize / 2,
								cropY + cropHeight - handleSize / 2,
								handleSize,
								handleSize
							);
						}
					}
				}

				// Handle audio clips: only set volume, currentTime is handled by playback control
				tracks.forEach((track) => {
					if (track.type === "audio") {
						const currentClip = track.clips.find(
							(clip) =>
								currentTime >= clip.startTime &&
								currentTime < clip.startTime + clip.duration
						);

						if (currentClip) {
							const audioElement =
								audioElementsRef.current[currentClip.id];
							if (audioElement) {
								audioElement.volume = currentClip.volume || 1;

								// Don't set currentTime here - it causes audio interruptions
								// The audio elements will play continuously and stay in sync naturally
							}
						}
					}
				});
			};

			const interval = setInterval(
				renderFrame,
				1000 / (24 * playbackSpeed)
			); // Adjust FPS based on playback speed
			return () => clearInterval(interval);
		}, [tracks, currentTime, playbackSpeed, selectedClip]); // Added selectedClip to dependencies

		useEffect(() => {
			// Create video and audio elements for each clip
			tracks.forEach((track) => {
				track.clips.forEach((clip) => {
					if (track.type === "video") {
						if (!videoElementsRef.current[clip.id]) {
							const video = document.createElement("video");
							video.src = clip.source;
							video.muted = true;
							video.loop = false; // Don't loop, we'll control playback manually
							video.preload = "auto"; // Preload more data for better slow playback
							videoElementsRef.current[clip.id] = video;
						}
					} else if (track.type === "audio") {
						if (!audioElementsRef.current[clip.id]) {
							const audio = document.createElement("audio");
							audio.src = clip.source;
							audio.loop = false; // Don't loop, we'll control playback manually
							audio.preload = "auto"; // Preload more data for better slow playback
							audioElementsRef.current[clip.id] = audio;
						}
					}
				});
			});

			return () => {
				// Cleanup: Identify and remove elements for clips that are no longer in tracks
				const currentClipIds = new Set();
				tracks.forEach((track) =>
					track.clips.forEach((clip) => currentClipIds.add(clip.id))
				);

				// Clean up video elements no longer in tracks
				Object.keys(videoElementsRef.current).forEach((clipId) => {
					if (!currentClipIds.has(clipId)) {
						videoElementsRef.current[clipId].pause(); // Pause before removing
						videoElementsRef.current[clipId].remove();
						delete videoElementsRef.current[clipId];
					}
				});

				// Clean up audio elements no longer in tracks
				Object.keys(audioElementsRef.current).forEach((clipId) => {
					if (!currentClipIds.has(clipId)) {
						audioElementsRef.current[clipId].pause(); // Pause before removing
						audioElementsRef.current[clipId].remove();
						delete audioElementsRef.current[clipId];
					}
				});
			};
		}, [tracks]);

		// New useEffect for playback control and speed
		useEffect(() => {
			const allLoadedMediaIds = new Set([
				...Object.keys(videoElementsRef.current),
				...Object.keys(audioElementsRef.current),
			]);

			// Handle global pause
			if (!isPlaying) {
				allLoadedMediaIds.forEach((clipId) => {
					const mediaElement =
						videoElementsRef.current[clipId] ||
						audioElementsRef.current[clipId];
					if (mediaElement && !mediaElement.paused) {
						mediaElement.pause();
					}
				});
				return;
			}

			// If playing, manage active clips
			const currentlyActiveClipIds = new Set();
			tracks.forEach((track) => {
				track.clips.forEach((clip) => {
					if (
						currentTime >= clip.startTime &&
						currentTime < clip.startTime + clip.duration
					) {
						currentlyActiveClipIds.add(clip.id);
					}
				});
			});

			allLoadedMediaIds.forEach((clipId) => {
				const mediaElement =
					videoElementsRef.current[clipId] ||
					audioElementsRef.current[clipId];
				if (!mediaElement) return;

				// Update playback rate
				mediaElement.playbackRate = playbackSpeed;

				const shouldBeActive = currentlyActiveClipIds.has(clipId);
				const isCurrentlyPlaying = !mediaElement.paused;

				if (shouldBeActive && !isCurrentlyPlaying) {
					if (mediaElement.readyState >= 2) {
						// Set initial time and start playing
						const clip = tracks
							.flatMap((t) => t.clips)
							.find((c) => c.id === clipId);
						if (clip) {
							const clipTime =
								currentTime - clip.startTime + clip.trimStart;
							mediaElement.currentTime = clipTime;
						}
						mediaElement
							.play()
							.catch((e) =>
								console.error(
									`Error playing clip ${clipId}:`,
									e
								)
							);
					}
				} else if (!shouldBeActive && isCurrentlyPlaying) {
					mediaElement.pause();
				}
			});
		}, [isPlaying, tracks, currentTime, playbackSpeed]);

		// New useEffect to update video currentTime when cursor moves (even when paused)
		useEffect(() => {
			// Update video elements' currentTime to match the timeline position
			Object.keys(videoElementsRef.current).forEach((clipId) => {
				const videoElement = videoElementsRef.current[clipId];
				if (!videoElement || videoElement.readyState < 2) return;

				// Find the clip data
				const clip = tracks
					.flatMap((t) => t.clips)
					.find((c) => c.id === clipId);
				if (!clip) return;

				// Check if current time is within this clip's range
				if (
					currentTime >= clip.startTime &&
					currentTime < clip.startTime + clip.duration
				) {
					// Calculate the clip's internal time
					const clipTime =
						currentTime - clip.startTime + clip.trimStart;

					// Only update if the time difference is significant to avoid unnecessary seeking
					if (Math.abs(videoElement.currentTime - clipTime) > 0.1) {
						videoElement.currentTime = clipTime;
					}
				}
			});
		}, [currentTime, tracks]);

		// Timer effect to move cursor when playing
		useEffect(() => {
			let interval;
			if (isPlaying) {
				interval = setInterval(() => {
					const newTime = currentTime + 0.1 * playbackSpeed; // Update current time based on speed
					if (newTime >= duration) {
						// Stop playing when reaching the end
						onTimeUpdate(duration);
						onPlayPause(); // This will set isPlaying to false
					} else {
						onTimeUpdate(newTime);
					}
				}, 100);
			}
			return () => {
				if (interval) {
					clearInterval(interval);
				}
			};
		}, [
			isPlaying,
			currentTime,
			duration,
			onTimeUpdate,
			onPlayPause,
			playbackSpeed,
		]);

		return (
			<div className="video-player">
				<canvas
					ref={canvasRef}
					width={640}
					height={360}
					className={`video-canvas ${
						isDragging
							? "dragging"
							: isResizing
							? "resizing"
							: isSelectedClipVisible()
							? "interactive"
							: ""
					}`}
					onMouseDown={handleCanvasMouseDown}
					onMouseMove={handleCanvasMouseMove}
					onMouseUp={handleCanvasMouseUp}
				/>
				<div className="player-controls">
					<button onClick={onPlayPause}>
						{isPlaying ? "⏸️ Pause" : "▶️ Play"}
					</button>
					<div className="time-display">
						{Math.floor(currentTime)}s
					</div>
					<div className="playback-speed-controls">
						<label htmlFor="playback-speed">Speed:</label>
						<select
							id="playback-speed"
							value={playbackSpeed}
							onChange={(e) =>
								setPlaybackSpeed(parseFloat(e.target.value))
							}
						>
							<option value={0.5}>0.5x</option>
							<option value={1}>1x</option>
							<option value={1.5}>1.5x</option>
							<option value={2}>2x</option>
							<option value={4}>4x</option>
						</select>
					</div>
				</div>
			</div>
		);
	}
);

VideoPlayer.displayName = "VideoPlayer";

export default VideoPlayer;
