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
			selectedTool,
			onTimeUpdate,
			onDurationChange,
			onPlayPause,
			onCropChange,
			onPositionChange,
			onScaleChange,
		},
		ref
	) => {
		const canvasRef = useRef(null);
		const videoElementsRef = useRef({});
		const audioElementsRef = useRef({});
		const [playbackSpeed, setPlaybackSpeed] = useState(1); // Local state for playback speed
		const [isDragging, setIsDragging] = useState(false);
		const [isResizing, setIsResizing] = useState(false);
		const [isCropDragging, setIsCropDragging] = useState(false);
		const [cropDragStart, setCropDragStart] = useState({ x: 0, y: 0 });
		const [cropDragEnd, setCropDragEnd] = useState({ x: 0, y: 0 });
		const [isMoveDragging, setIsMoveDragging] = useState(false);
		const [moveDragStart, setMoveDragStart] = useState({ x: 0, y: 0 });
		const [moveDragEnd, setMoveDragEnd] = useState({ x: 0, y: 0 });
		const [originalPosition, setOriginalPosition] = useState({
			x: 0,
			y: 0,
		});
		const [isScaleDragging, setIsScaleDragging] = useState(false);
		const [scaleDragStart, setScaleDragStart] = useState({ x: 0, y: 0 });
		const [scaleDragEnd, setScaleDragEnd] = useState({ x: 0, y: 0 });
		const [originalScale, setOriginalScale] = useState(1.0);
		const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
		const [resizeHandle, setResizeHandle] = useState(null);
		const [originalCrop, setOriginalCrop] = useState(null);
		// const clipPlayingStateRef = useRef(new Map()); // Removed: ref to track individual clip playback state
		// const activeMediaElementRef = useRef(null); // Removed: New ref to track the currently active playing media element

		// Helper function to get canvas coordinates
		const getCanvasCoordinates = (clientX, clientY) => {
			const canvas = canvasRef.current;
			const rect = canvas.getBoundingClientRect();
			return {
				x: ((clientX - rect.left) * canvas.width) / rect.width,
				y: ((clientY - rect.top) * canvas.height) / rect.height,
			};
		};

		// Helper function to get crop destination coordinates
		const getCropDestinationCoords = (
			crop,
			videoElement,
			scale = 1.0,
			position = { x: 0, y: 0 }
		) => {
			const canvas = canvasRef.current;
			const sourceWidth = (videoElement.videoWidth * crop.width) / 100;
			const sourceHeight = (videoElement.videoHeight * crop.height) / 100;

			// Apply scale to the cropped content
			const destWidth = sourceWidth * scale;
			const destHeight = sourceHeight * scale;

			// Center the crop on the canvas and apply position offset
			const destX =
				(canvas.width - destWidth) / 2 +
				(canvas.width * position.x) / 100;
			const destY =
				(canvas.height - destHeight) / 2 +
				(canvas.height * position.y) / 100;

			return { destX, destY, destWidth, destHeight };
		};

		// Helper function to convert canvas coordinates to crop coordinates
		const canvasToCropCoords = (
			canvasX,
			canvasY,
			crop,
			videoElement,
			scale = 1.0,
			position = { x: 0, y: 0 }
		) => {
			const { destX, destY, destWidth, destHeight } =
				getCropDestinationCoords(crop, videoElement, scale, position);

			// Check if point is within the crop area
			if (
				canvasX < destX ||
				canvasX > destX + destWidth ||
				canvasY < destY ||
				canvasY > destY + destHeight
			) {
				return null;
			}

			// Convert to crop-relative coordinates (0-100)
			const cropX = ((canvasX - destX) / destWidth) * 100;
			const cropY = ((canvasY - destY) / destHeight) * 100;

			return { x: cropX, y: cropY };
		};

		// Helper function to check if a point is in a resize handle
		const getResizeHandle = (
			x,
			y,
			crop,
			videoElement,
			scale = 1.0,
			position = { x: 0, y: 0 }
		) => {
			const { destX, destY, destWidth, destHeight } =
				getCropDestinationCoords(crop, videoElement, scale, position);
			const handleSize = 6;

			// Check if point is within the crop area
			if (
				x < destX ||
				x > destX + destWidth ||
				y < destY ||
				y > destY + destHeight
			) {
				return null;
			}

			// Convert to crop-relative coordinates
			const cropX = ((x - destX) / destWidth) * 100;
			const cropY = ((y - destY) / destHeight) * 100;

			// Convert handle size to crop-relative size
			const handleSizePercent = (handleSize / destWidth) * 100;

			// Check corner handles
			if (cropX <= handleSizePercent && cropY <= handleSizePercent)
				return "top-left";
			if (cropX >= 100 - handleSizePercent && cropY <= handleSizePercent)
				return "top-right";
			if (cropX <= handleSizePercent && cropY >= 100 - handleSizePercent)
				return "bottom-left";
			if (
				cropX >= 100 - handleSizePercent &&
				cropY >= 100 - handleSizePercent
			)
				return "bottom-right";

			// Check edge handles
			if (
				cropX <= handleSizePercent &&
				cropY > handleSizePercent &&
				cropY < 100 - handleSizePercent
			)
				return "left";
			if (
				cropX >= 100 - handleSizePercent &&
				cropY > handleSizePercent &&
				cropY < 100 - handleSizePercent
			)
				return "right";
			if (
				cropY <= handleSizePercent &&
				cropX > handleSizePercent &&
				cropX < 100 - handleSizePercent
			)
				return "top";
			if (
				cropY >= 100 - handleSizePercent &&
				cropX > handleSizePercent &&
				cropX < 100 - handleSizePercent
			)
				return "bottom";

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
			// Handle crop tool dragging
			if (selectedTool === "crop" && selectedClip) {
				const coords = getCanvasCoordinates(e.clientX, e.clientY);
				e.preventDefault();
				e.stopPropagation();
				setIsCropDragging(true);
				setCropDragStart(coords);
				setCropDragEnd(coords);
				return;
			}

			// Handle move tool dragging
			if (selectedTool === "move" && selectedClip) {
				const clip = tracks
					.flatMap((t) => t.clips)
					.find((c) => c.id === selectedClip.clipId);
				if (!clip) return;

				const coords = getCanvasCoordinates(e.clientX, e.clientY);
				e.preventDefault();
				e.stopPropagation();
				setIsMoveDragging(true);
				setMoveDragStart(coords);
				setMoveDragEnd(coords);
				setOriginalPosition({
					x: clip.position?.x || 0,
					y: clip.position?.y || 0,
				});
				return;
			}

			// Handle scale tool dragging
			if (selectedTool === "scale" && selectedClip) {
				const clip = tracks
					.flatMap((t) => t.clips)
					.find((c) => c.id === selectedClip.clipId);
				if (!clip) return;

				const coords = getCanvasCoordinates(e.clientX, e.clientY);
				e.preventDefault();
				e.stopPropagation();
				setIsScaleDragging(true);
				setScaleDragStart(coords);
				setScaleDragEnd(coords);
				setOriginalScale(clip.scale || 1.0);
				return;
			}

			// Handle existing crop resize/drag functionality
			if (!isSelectedClipVisible()) return;

			const clip = tracks
				.flatMap((t) => t.clips)
				.find((c) => c.id === selectedClip.clipId);
			if (!clip || !clip.crop) return;

			const videoElement = videoElementsRef.current[clip.id];
			if (!videoElement) return;

			const coords = getCanvasCoordinates(e.clientX, e.clientY);
			const scale = clip.scale || 1.0;
			const position = clip.position || { x: 0, y: 0 };
			const handle = getResizeHandle(
				coords.x,
				coords.y,
				clip.crop,
				videoElement,
				scale,
				position
			);

			if (handle) {
				// Start resizing
				e.preventDefault();
				e.stopPropagation();
				setIsResizing(true);
				setResizeHandle(handle);
				setOriginalCrop({ ...clip.crop });
				setDragStart(coords);
			} else {
				// Check if clicking inside the crop area for dragging
				const cropCoords = canvasToCropCoords(
					coords.x,
					coords.y,
					clip.crop,
					videoElement,
					scale,
					position
				);

				if (cropCoords) {
					e.preventDefault();
					e.stopPropagation();
					setIsDragging(true);
					setDragStart(coords);
					setOriginalCrop({ ...clip.crop });
				}
			}
		};

		const handleCanvasMouseMove = (e) => {
			// Handle crop tool dragging
			if (isCropDragging) {
				const coords = getCanvasCoordinates(e.clientX, e.clientY);
				setCropDragEnd(coords);
				return;
			}

			// Handle move tool dragging
			if (isMoveDragging && selectedClip) {
				const coords = getCanvasCoordinates(e.clientX, e.clientY);
				setMoveDragEnd(coords);
				return;
			}

			// Handle scale tool dragging
			if (isScaleDragging && selectedClip) {
				const coords = getCanvasCoordinates(e.clientX, e.clientY);
				setScaleDragEnd(coords);
				return;
			}

			// Handle existing crop resize/drag functionality
			if (!isSelectedClipVisible()) return;

			const clip = tracks
				.flatMap((t) => t.clips)
				.find((c) => c.id === selectedClip.clipId);
			if (!clip || !clip.crop) return;

			const videoElement = videoElementsRef.current[clip.id];
			if (!videoElement) return;

			const coords = getCanvasCoordinates(e.clientX, e.clientY);
			const scale = clip.scale || 1.0;
			const position = clip.position || { x: 0, y: 0 };

			if (isResizing && resizeHandle && originalCrop) {
				e.preventDefault();
				e.stopPropagation();

				// Convert current and start coordinates to crop-relative coordinates
				const currentCropCoords = canvasToCropCoords(
					coords.x,
					coords.y,
					originalCrop,
					videoElement,
					scale,
					position
				);
				const startCropCoords = canvasToCropCoords(
					dragStart.x,
					dragStart.y,
					originalCrop,
					videoElement,
					scale,
					position
				);

				if (!currentCropCoords || !startCropCoords) return;

				// Calculate delta in crop-relative coordinates
				const deltaX = currentCropCoords.x - startCropCoords.x;
				const deltaY = currentCropCoords.y - startCropCoords.y;

				let newCrop = { ...originalCrop };

				switch (resizeHandle) {
					case "top-left":
						newCrop.x = Math.max(
							0,
							Math.min(
								originalCrop.x + originalCrop.width - 10,
								originalCrop.x + deltaX
							)
						);
						newCrop.y = Math.max(
							0,
							Math.min(
								originalCrop.y + originalCrop.height - 10,
								originalCrop.y + deltaY
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
								originalCrop.y + deltaY
							)
						);
						newCrop.width = Math.max(
							10,
							originalCrop.width + deltaX
						);
						newCrop.height =
							originalCrop.height - (newCrop.y - originalCrop.y);
						break;
					case "bottom-left":
						newCrop.x = Math.max(
							0,
							Math.min(
								originalCrop.x + originalCrop.width - 10,
								originalCrop.x + deltaX
							)
						);
						newCrop.width =
							originalCrop.width - (newCrop.x - originalCrop.x);
						newCrop.height = Math.max(
							10,
							originalCrop.height + deltaY
						);
						break;
					case "bottom-right":
						newCrop.width = Math.max(
							10,
							originalCrop.width + deltaX
						);
						newCrop.height = Math.max(
							10,
							originalCrop.height + deltaY
						);
						break;
					case "left":
						newCrop.x = Math.max(
							0,
							Math.min(
								originalCrop.x + originalCrop.width - 10,
								originalCrop.x + deltaX
							)
						);
						newCrop.width =
							originalCrop.width - (newCrop.x - originalCrop.x);
						break;
					case "right":
						newCrop.width = Math.max(
							10,
							originalCrop.width + deltaX
						);
						break;
					case "top":
						newCrop.y = Math.max(
							0,
							Math.min(
								originalCrop.y + originalCrop.height - 10,
								originalCrop.y + deltaY
							)
						);
						newCrop.height =
							originalCrop.height - (newCrop.y - originalCrop.y);
						break;
					case "bottom":
						newCrop.height = Math.max(
							10,
							originalCrop.height + deltaY
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
				e.preventDefault();
				e.stopPropagation();

				// Convert current and start coordinates to crop-relative coordinates
				const currentCropCoords = canvasToCropCoords(
					coords.x,
					coords.y,
					originalCrop,
					videoElement,
					scale,
					position
				);
				const startCropCoords = canvasToCropCoords(
					dragStart.x,
					dragStart.y,
					originalCrop,
					videoElement,
					scale,
					position
				);

				if (!currentCropCoords || !startCropCoords) return;

				// Calculate delta in crop-relative coordinates
				const deltaX = currentCropCoords.x - startCropCoords.x;
				const deltaY = currentCropCoords.y - startCropCoords.y;

				const newCrop = {
					x: Math.max(
						0,
						Math.min(
							100 - originalCrop.width,
							originalCrop.x + deltaX
						)
					),
					y: Math.max(
						0,
						Math.min(
							100 - originalCrop.height,
							originalCrop.y + deltaY
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
			// Handle crop tool dragging completion
			if (isCropDragging && selectedClip) {
				const canvas = canvasRef.current;
				if (!canvas) return;

				// Calculate the crop rectangle from drag start and end points
				const startX = Math.min(cropDragStart.x, cropDragEnd.x);
				const startY = Math.min(cropDragStart.y, cropDragEnd.y);
				const endX = Math.max(cropDragStart.x, cropDragEnd.x);
				const endY = Math.max(cropDragStart.y, cropDragEnd.y);

				// Convert to percentage values (0-100)
				const cropX = (startX / canvas.width) * 100;
				const cropY = (startY / canvas.height) * 100;
				const cropWidth = ((endX - startX) / canvas.width) * 100;
				const cropHeight = ((endY - startY) / canvas.height) * 100;

				// Ensure minimum size and bounds
				const finalCrop = {
					x: Math.max(0, Math.min(100 - cropWidth, cropX)),
					y: Math.max(0, Math.min(100 - cropHeight, cropY)),
					width: Math.max(5, Math.min(100 - cropX, cropWidth)),
					height: Math.max(5, Math.min(100 - cropY, cropHeight)),
				};

				// Update the clip's crop
				if (onCropChange) {
					onCropChange(
						selectedClip.trackId,
						selectedClip.clipId,
						finalCrop
					);
				}

				// Reset crop dragging state
				setIsCropDragging(false);
				setCropDragStart({ x: 0, y: 0 });
				setCropDragEnd({ x: 0, y: 0 });
				return;
			}

			// Handle move tool dragging completion
			if (isMoveDragging && selectedClip) {
				const canvas = canvasRef.current;
				if (!canvas) return;

				// Calculate the movement delta
				const deltaX = moveDragEnd.x - moveDragStart.x;
				const deltaY = moveDragEnd.y - moveDragStart.y;

				// Convert to percentage values relative to canvas size
				const deltaXPercent = (deltaX / canvas.width) * 100;
				const deltaYPercent = (deltaY / canvas.height) * 100;

				// Calculate new position
				const newPosition = {
					x: originalPosition.x + deltaXPercent,
					y: originalPosition.y + deltaYPercent,
				};

				// Update the clip's position
				if (onPositionChange) {
					onPositionChange(
						selectedClip.trackId,
						selectedClip.clipId,
						newPosition
					);
				}

				// Reset move dragging state
				setIsMoveDragging(false);
				setMoveDragStart({ x: 0, y: 0 });
				setMoveDragEnd({ x: 0, y: 0 });
				setOriginalPosition({ x: 0, y: 0 });
				return;
			}

			// Handle scale tool dragging completion
			if (isScaleDragging && selectedClip) {
				const canvas = canvasRef.current;
				if (!canvas) return;

				// Calculate the center of the canvas
				const centerX = canvas.width / 2;
				const centerY = canvas.height / 2;

				// Calculate distances from center
				const startDistanceFromCenter = Math.sqrt(
					Math.pow(scaleDragStart.x - centerX, 2) +
						Math.pow(scaleDragStart.y - centerY, 2)
				);
				const endDistanceFromCenter = Math.sqrt(
					Math.pow(scaleDragEnd.x - centerX, 2) +
						Math.pow(scaleDragEnd.y - centerY, 2)
				);

				// Calculate scale change based on distance change
				const distanceChange =
					endDistanceFromCenter - startDistanceFromCenter;
				const scaleChange = distanceChange / 100; // Adjust sensitivity

				// Calculate new scale
				const newScale = originalScale + scaleChange;

				// Update the clip's scale
				if (onScaleChange) {
					onScaleChange(
						selectedClip.trackId,
						selectedClip.clipId,
						newScale
					);
				}

				// Reset scale dragging state
				setIsScaleDragging(false);
				setScaleDragStart({ x: 0, y: 0 });
				setScaleDragEnd({ x: 0, y: 0 });
				setOriginalScale(newScale);
				return;
			}

			// Handle existing crop resize/drag functionality
			setIsDragging(false);
			setIsResizing(false);
			setResizeHandle(null);
			setOriginalCrop(null);
		};

		// Add global mouse event listeners
		useEffect(() => {
			const handleGlobalMouseUp = () => {
				if (
					isDragging ||
					isResizing ||
					isCropDragging ||
					isMoveDragging ||
					isScaleDragging
				) {
					setIsDragging(false);
					setIsResizing(false);
					setIsCropDragging(false);
					setIsMoveDragging(false);
					setIsScaleDragging(false);
					setResizeHandle(null);
					setOriginalCrop(null);
					setCropDragStart({ x: 0, y: 0 });
					setCropDragEnd({ x: 0, y: 0 });
					setMoveDragStart({ x: 0, y: 0 });
					setMoveDragEnd({ x: 0, y: 0 });
					setOriginalPosition({ x: 0, y: 0 });
					setScaleDragStart({ x: 0, y: 0 });
					setScaleDragEnd({ x: 0, y: 0 });
					setOriginalScale(1.0);
				}
			};

			const handleGlobalMouseMove = (e) => {
				if (
					isDragging ||
					isResizing ||
					isCropDragging ||
					isMoveDragging ||
					isScaleDragging
				) {
					e.preventDefault();
					e.stopPropagation();
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
			isCropDragging,
			isMoveDragging,
			isScaleDragging,
			selectedClip,
			tracks,
			currentTime,
			originalCrop,
			resizeHandle,
			dragStart,
			cropDragStart,
			cropDragEnd,
			moveDragStart,
			moveDragEnd,
			originalPosition,
			scaleDragStart,
			scaleDragEnd,
			originalScale,
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
						const scale = topVideoClip.scale || 1.0;
						const position = topVideoClip.position || {
							x: 0,
							y: 0,
						};
						const sourceX =
							(videoElement.videoWidth * crop.x) / 100;
						const sourceY =
							(videoElement.videoHeight * crop.y) / 100;
						const sourceWidth =
							(videoElement.videoWidth * crop.width) / 100;
						const sourceHeight =
							(videoElement.videoHeight * crop.height) / 100;

						// Get destination coordinates using the helper function
						const { destX, destY, destWidth, destHeight } =
							getCropDestinationCoords(
								crop,
								videoElement,
								scale,
								position
							);

						ctx.drawImage(
							videoElement,
							sourceX,
							sourceY,
							sourceWidth,
							sourceHeight,
							destX,
							destY,
							destWidth,
							destHeight
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

							// Use the same destination coordinates as the video rendering
							const cropX = destX;
							const cropY = destY;
							const cropWidth = destWidth;
							const cropHeight = destHeight;

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

				// Draw crop overlay when crop tool is active and dragging
				if (isCropDragging && selectedTool === "crop") {
					const canvas = canvasRef.current;

					// Calculate the crop rectangle from drag start and end points
					const startX = Math.min(cropDragStart.x, cropDragEnd.x);
					const startY = Math.min(cropDragStart.y, cropDragEnd.y);
					const endX = Math.max(cropDragStart.x, cropDragEnd.x);
					const endY = Math.max(cropDragStart.y, cropDragEnd.y);
					const cropWidth = endX - startX;
					const cropHeight = endY - startY;

					// Draw crop rectangle border
					ctx.strokeStyle = "#00ff00";
					ctx.lineWidth = 2;
					ctx.setLineDash([5, 5]);
					ctx.strokeRect(startX, startY, cropWidth, cropHeight);
					ctx.setLineDash([]);

					// Draw crop area label
					ctx.fillStyle = "#00ff00";
					ctx.font = "14px Arial";
					ctx.textAlign = "center";
					const labelX = startX + cropWidth / 2;
					const labelY = startY - 10;
					ctx.fillText("Crop Area", labelX, labelY);
				}

				// Draw move preview when move tool is active and dragging
				if (isMoveDragging && selectedTool === "move" && selectedClip) {
					const clip = tracks
						.flatMap((t) => t.clips)
						.find((c) => c.id === selectedClip.clipId);

					if (clip) {
						const videoElement = videoElementsRef.current[clip.id];
						if (videoElement && videoElement.readyState >= 2) {
							// Calculate the movement delta
							const deltaX = moveDragEnd.x - moveDragStart.x;
							const deltaY = moveDragEnd.y - moveDragStart.y;

							// Convert to percentage values relative to canvas size
							const canvas = canvasRef.current;
							const deltaXPercent = (deltaX / canvas.width) * 100;
							const deltaYPercent =
								(deltaY / canvas.height) * 100;

							// Calculate preview position
							const previewPosition = {
								x: originalPosition.x + deltaXPercent,
								y: originalPosition.y + deltaYPercent,
							};

							// Get crop and scale from clip
							const crop = clip.crop || {
								x: 0,
								y: 0,
								width: 100,
								height: 100,
							};
							const scale = clip.scale || 1.0;

							// Get destination coordinates for preview
							const { destX, destY, destWidth, destHeight } =
								getCropDestinationCoords(
									crop,
									videoElement,
									scale,
									previewPosition
								);

							// Draw preview boundary
							ctx.strokeStyle = "#ff6600";
							ctx.lineWidth = 2;
							ctx.setLineDash([8, 4]);
							ctx.strokeRect(destX, destY, destWidth, destHeight);
							ctx.setLineDash([]);

							// Draw preview label
							ctx.fillStyle = "#ff6600";
							ctx.font = "14px Arial";
							ctx.textAlign = "center";
							const labelX = destX + destWidth / 2;
							const labelY = destY - 10;
							ctx.fillText("Move Preview", labelX, labelY);
						}
					}
				}

				// Draw scale preview when scale tool is active and dragging
				if (
					isScaleDragging &&
					selectedTool === "scale" &&
					selectedClip
				) {
					const clip = tracks
						.flatMap((t) => t.clips)
						.find((c) => c.id === selectedClip.clipId);

					if (clip) {
						const videoElement = videoElementsRef.current[clip.id];
						if (videoElement && videoElement.readyState >= 2) {
							const canvas = canvasRef.current;

							// Calculate the center of the canvas
							const centerX = canvas.width / 2;
							const centerY = canvas.height / 2;

							// Calculate distances from center
							const startDistanceFromCenter = Math.sqrt(
								Math.pow(scaleDragStart.x - centerX, 2) +
									Math.pow(scaleDragStart.y - centerY, 2)
							);
							const endDistanceFromCenter = Math.sqrt(
								Math.pow(scaleDragEnd.x - centerX, 2) +
									Math.pow(scaleDragEnd.y - centerY, 2)
							);

							// Calculate scale change based on distance change
							const distanceChange =
								endDistanceFromCenter - startDistanceFromCenter;
							const scaleChange = distanceChange / 100; // Adjust sensitivity

							// Calculate preview scale
							const previewScale = originalScale + scaleChange;

							// Get crop and position from clip
							const crop = clip.crop || {
								x: 0,
								y: 0,
								width: 100,
								height: 100,
							};
							const position = clip.position || { x: 0, y: 0 };

							// Get destination coordinates for preview
							const { destX, destY, destWidth, destHeight } =
								getCropDestinationCoords(
									crop,
									videoElement,
									previewScale,
									position
								);

							// Draw preview boundary
							ctx.strokeStyle = "#00ccff";
							ctx.lineWidth = 2;
							ctx.setLineDash([8, 4]);
							ctx.strokeRect(destX, destY, destWidth, destHeight);
							ctx.setLineDash([]);

							// Draw preview label
							ctx.fillStyle = "#00ccff";
							ctx.font = "14px Arial";
							ctx.textAlign = "center";
							const labelX = destX + destWidth / 2;
							const labelY = destY - 10;
							ctx.fillText(
								`Scale: ${previewScale.toFixed(2)}x`,
								labelX,
								labelY
							);
						}
					}
				}
			};

			const interval = setInterval(
				renderFrame,
				1000 / (24 * playbackSpeed)
			); // Adjust FPS based on playback speed
			return () => clearInterval(interval);
		}, [
			tracks,
			currentTime,
			playbackSpeed,
			isCropDragging,
			isMoveDragging,
			isScaleDragging,
			selectedTool,
			cropDragStart,
			cropDragEnd,
			moveDragStart,
			moveDragEnd,
			scaleDragStart,
			scaleDragEnd,
			originalScale,
		]); // Added scale dragging dependencies

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
							: selectedTool === "crop"
							? "crop-tool"
							: selectedTool === "scale"
							? "scale-tool"
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
