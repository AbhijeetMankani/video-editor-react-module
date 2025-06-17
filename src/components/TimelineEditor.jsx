import React, { useState, useRef, useEffect } from "react";
import "./TimelineEditor.css";
import { checkForOverlaps } from "../utils/checkForOverlaps";
import { createFileInput } from "../utils/fileUploadUtils";

const MIN_DURATION = 0.5; // seconds

const TimelineEditor = ({
	tracks,
	currentTime,
	duration,
	zoom,
	selectedClip,
	onClipSelect,
	onClipMove,
	onClipTrim,
	onClipCrop,
	onAddTrack,
	onAddClip,
	onAddClipFromFile,
	onSeek,
	onClipUpdate,
	checkForOverlaps,
	onReorderTracks,
	onDeleteClip,
	onDeleteTrack,
	onZoomChange,
}) => {
	const [dragging, setDragging] = useState(null);
	const [resizing, setResizing] = useState(null);
	const [cursorDragging, setCursorDragging] = useState(false);
	const [dragStartX, setDragStartX] = useState(0);
	const [dragStartY, setDragStartY] = useState(0);
	const [originalStartTime, setOriginalStartTime] = useState(0);
	const [originalDuration, setOriginalDuration] = useState(0);
	const [scrollLeft, setScrollLeft] = useState(0);
	const timelineRef = useRef(null);
	const trackRefs = useRef([]);
	const rulerRef = useRef(null);

	const pixelsPerSecond = 50 * zoom;
	const timelineWidth = duration * pixelsPerSecond;

	// Calculate time scale unit based on zoom level
	const getTimeScaleUnit = () => {
		if (zoom >= 5) return 0.1; // Show every 0.1 seconds when very zoomed in
		if (zoom >= 3) return 0.2; // Show every 0.2 seconds when zoomed in
		if (zoom >= 2) return 0.5; // Show every 0.5 seconds when zoomed in
		if (zoom >= 1) return 1; // Show every second at normal zoom
		if (zoom >= 0.5) return 2; // Show every 2 seconds when zoomed out
		if (zoom >= 0.2) return 5; // Show every 5 seconds when more zoomed out
		if (zoom >= 0.1) return 10; // Show every 10 seconds when very zoomed out
		return 30; // Show every 30 seconds when extremely zoomed out
	};

	const timeScaleUnit = getTimeScaleUnit();

	const handleRulerMouseDown = (e) => {
		e.stopPropagation();
		e.preventDefault();

		// Calculate the click position relative to the ruler content
		const rect = rulerRef.current.getBoundingClientRect();
		const clickX = e.clientX - rect.left + scrollLeft;
		const newTime = clickX / pixelsPerSecond;
		const clampedTime = Math.max(0, Math.min(duration, newTime));
		onSeek(clampedTime);

		// Start dragging mode
		setCursorDragging(true);
		setDragStartX(e.clientX);
	};

	const handleClipMouseDown = (e, clip, trackId, trackIdx) => {
		e.stopPropagation();
		const rect = e.currentTarget.getBoundingClientRect();
		const clickX = e.clientX - rect.left;
		const clipWidth = rect.width;

		if (clickX < 10) {
			setResizing({ clip, trackId, side: "start" });
			setDragStartX(e.clientX);
			setOriginalStartTime(clip.startTime);
			setOriginalDuration(clip.duration);
		} else if (clickX > clipWidth - 10) {
			setResizing({ clip, trackId, side: "end" });
			setDragStartX(e.clientX);
			setOriginalStartTime(clip.startTime);
			setOriginalDuration(clip.duration);
		} else {
			setDragging({ clip, trackId, trackIdx });
			setDragStartX(e.clientX);
			setDragStartY(e.clientY);
			setOriginalStartTime(clip.startTime);
		}
	};

	const handleMouseMove = (e) => {
		if (cursorDragging) {
			e.preventDefault();
			const rect = rulerRef.current.getBoundingClientRect();
			const clickX = e.clientX - rect.left + scrollLeft;

			// Only move cursor if mouse is still over the ruler area
			if (clickX >= 0 && clickX <= rect.width + scrollLeft) {
				const newTime = clickX / pixelsPerSecond;
				const clampedTime = Math.max(0, Math.min(duration, newTime));
				onSeek(clampedTime);
			}
			return; // Exit early when cursor dragging
		}

		if (dragging) {
			const deltaX = e.clientX - dragStartX;
			const deltaTime = deltaX / pixelsPerSecond;
			let newStartTime = Math.max(0, originalStartTime + deltaTime);

			let newTrackIdx = dragging.trackIdx;
			let newTrackId = dragging.trackId;
			let newTrackType = tracks[dragging.trackIdx].type;
			for (let i = 0; i < trackRefs.current.length; i++) {
				const ref = trackRefs.current[i];
				if (ref) {
					const rect = ref.getBoundingClientRect();
					if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
						newTrackIdx = i;
						newTrackId = tracks[i].id;
						newTrackType = tracks[i].type;
						break;
					}
				}
			}

			if (dragging.clip.type && newTrackType !== dragging.clip.type) {
				return;
			}

			const targetTrack = tracks[newTrackIdx];
			if (
				!checkForOverlaps(
					targetTrack,
					dragging.clip.id,
					newStartTime,
					dragging.clip.duration
				)
			) {
				if (newTrackId !== dragging.trackId) {
					onClipUpdate(dragging.trackId, dragging.clip.id, {
						_remove: true,
					});
					onClipUpdate(newTrackId, dragging.clip.id, {
						...dragging.clip,
						startTime: newStartTime,
						type: newTrackType,
					});
					setDragging({
						...dragging,
						trackId: newTrackId,
						trackIdx: newTrackIdx,
					});
				} else {
					onClipUpdate(dragging.trackId, dragging.clip.id, {
						startTime: newStartTime,
					});
				}
			}
		}
		if (resizing) {
			const deltaX = e.clientX - dragStartX;
			const deltaTime = deltaX / pixelsPerSecond;
			const track = tracks.find((t) => t.id === resizing.trackId);
			if (!track) return;

			// Use the clip's original duration property
			const clipOriginalDuration =
				resizing.clip.originalDuration || resizing.clip.duration;

			if (resizing.side === "start") {
				// Resizing from left side - update trim start and move start time
				let newTrimStart = (resizing.clip.trimStart || 0) + deltaTime;
				let newStartTime = originalStartTime + deltaTime;
				let newDuration = originalDuration - deltaTime;

				// Ensure trim start doesn't go negative
				if (newTrimStart < 0) {
					newTrimStart = 0;
					newStartTime =
						originalStartTime + (resizing.clip.trimStart || 0);
					newDuration =
						originalDuration + (resizing.clip.trimStart || 0);
				}

				// Ensure minimum duration
				if (newDuration < MIN_DURATION) {
					newTrimStart =
						(resizing.clip.trimStart || 0) +
						(originalDuration - MIN_DURATION);
					newStartTime =
						originalStartTime + (originalDuration - MIN_DURATION);
					newDuration = MIN_DURATION;
				}

				// Check for overlaps
				if (
					!checkForOverlaps(
						track,
						resizing.clip.id,
						newStartTime,
						newDuration
					)
				) {
					onClipUpdate(resizing.trackId, resizing.clip.id, {
						trimStart: newTrimStart,
						startTime: newStartTime,
						duration: newDuration,
					});
				}
			} else if (resizing.side === "end") {
				// Resizing from right side - update trim end
				let newTrimEnd =
					(resizing.clip.trimEnd || clipOriginalDuration) + deltaTime;
				let newDuration = originalDuration + deltaTime;

				// Ensure trim end doesn't go beyond the original clip length
				if (newTrimEnd > clipOriginalDuration) {
					newTrimEnd = clipOriginalDuration;
					newDuration =
						clipOriginalDuration - (resizing.clip.trimStart || 0);
				}

				// Ensure trim end doesn't go below trim start
				const currentTrimStart = resizing.clip.trimStart || 0;
				if (newTrimEnd <= currentTrimStart) {
					newTrimEnd = currentTrimStart + MIN_DURATION;
					newDuration = MIN_DURATION;
				}

				// Ensure minimum duration
				if (newDuration < MIN_DURATION) {
					newTrimEnd =
						(resizing.clip.trimEnd || clipOriginalDuration) -
						(originalDuration - MIN_DURATION);
					newDuration = MIN_DURATION;
				}

				// Check for overlaps
				if (
					!checkForOverlaps(
						track,
						resizing.clip.id,
						originalStartTime,
						newDuration
					)
				) {
					onClipUpdate(resizing.trackId, resizing.clip.id, {
						trimEnd: newTrimEnd,
						duration: newDuration,
					});
				}
			}
		}
	};

	const handleMouseUp = (e) => {
		if (cursorDragging) {
			e.preventDefault();
			setCursorDragging(false);
		}
		setDragging(null);
		setResizing(null);
	};

	useEffect(() => {
		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);

		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, [
		dragging,
		resizing,
		cursorDragging,
		dragStartX,
		originalStartTime,
		originalDuration,
	]);

	const renderClip = (clip, trackId, trackType, trackIdx) => {
		const clipLeft = clip.startTime * pixelsPerSecond;
		const clipWidth = clip.duration * pixelsPerSecond;
		const isSelected = selectedClip?.clipId === clip.id;
		const displayName = clip.name || clip.id;

		const handleDeleteClip = (e) => {
			e.stopPropagation();
			if (window.confirm("Are you sure you want to delete this clip?")) {
				onDeleteClip(trackId, clip.id);
			}
		};

		return (
			<div
				key={clip.id}
				className={`timeline-clip ${trackType} ${
					isSelected ? "selected" : ""
				}`}
				style={{
					left: `${clipLeft}px`,
					width: `${clipWidth}px`,
				}}
				onMouseDown={(e) =>
					handleClipMouseDown(e, clip, trackId, trackIdx)
				}
				onClick={(e) => {
					e.stopPropagation();
					// If the clip is already selected, unselect it
					if (isSelected) {
						onClipSelect(null);
					} else {
						// Otherwise, select the clip
						onClipSelect({
							clipId: clip.id,
							trackId,
							type: trackType,
							...clip,
						});
					}
					// Move cursor to the beginning of the clip
					// onSeek(clip.startTime);
				}}
			>
				<div className="clip-content">
					<div className="clip-name">
						{trackType === "video" ? "🎥" : "🎵"} {displayName}
					</div>
					<div className="clip-duration">
						{clip.duration.toFixed(1)}s
					</div>
				</div>
				<button
					className="clip-delete-btn"
					onClick={handleDeleteClip}
					title="Delete Clip"
				>
					×
				</button>
				<div className="resize-handle left" />
				<div className="resize-handle right" />
			</div>
		);
	};

	return (
		<div className="timeline-editor" style={{ position: "relative" }}>
			<div className="timeline-header">
				<div className="timeline-header-controls-row">
					<div className="timeline-add-track-controls">
						<button onClick={() => onAddTrack("video")}>
							Add Video Track
						</button>
						<button onClick={() => onAddTrack("audio")}>
							Add Audio Track
						</button>
					</div>
					<div className="timeline-zoom-controls">
						<input
							type="range"
							min="0.1"
							max="5"
							step="0.1"
							value={zoom}
							onChange={(e) =>
								onZoomChange(parseFloat(e.target.value))
							}
							className="zoom-slider"
						/>
						<input
							type="number"
							min="10"
							max="500"
							step="1"
							value={Math.round(zoom * 100)}
							onChange={(e) => {
								const newZoom = Math.max(
									0.1,
									Math.min(
										5,
										parseFloat(e.target.value) / 100
									)
								);
								onZoomChange(newZoom);
							}}
							className="zoom-input"
						/>
						<span className="zoom-label">%</span>
					</div>
				</div>
			</div>

			<div className="timeline-main">
				{/* Fixed track headers */}
				<div className="timeline-track-headers">
					<div className="timeline-track-header-title">
						<span>Tracks</span>
					</div>
					{tracks.map((track, idx) => {
						const handleFileUpload = () => {
							const accept =
								track.type === "video" ? "video/*" : "audio/*";
							createFileInput(accept, (file) => {
								onAddClipFromFile(track.id, file);
							});
						};

						const handleMoveUp = () => {
							if (idx > 0) {
								onReorderTracks(idx, idx - 1);
							}
						};

						const handleMoveDown = () => {
							if (idx < tracks.length - 1) {
								onReorderTracks(idx, idx + 1);
							}
						};

						const handleDeleteTrack = () => {
							if (
								window.confirm(
									`Are you sure you want to delete "${track.name}" and all its clips?`
								)
							) {
								onDeleteTrack(track.id);
							}
						};

						return (
							<div
								key={track.id}
								className="timeline-track-header-fixed"
							>
								<div className="track-reorder-controls">
									<button
										className="reorder-btn up-btn"
										title="Move Track Up"
										onClick={handleMoveUp}
										disabled={idx === 0}
									>
										▲
									</button>
									<button
										className="reorder-btn down-btn"
										title="Move Track Down"
										onClick={handleMoveDown}
										disabled={idx === tracks.length - 1}
									>
										▼
									</button>
								</div>
								<span className="track-name">{track.name}</span>
								<div className="track-controls">
									<button
										className="add-clip-btn"
										title={`Upload ${track.type} File`}
										onClick={handleFileUpload}
									>
										+
									</button>
									<button
										className="delete-track-btn"
										title="Delete Track"
										onClick={handleDeleteTrack}
									>
										🗑️
									</button>
								</div>
							</div>
						);
					})}
				</div>

				{/* Scrollable timeline content */}
				<div className="timeline-scrollable-content">
					{/* Fixed time ruler */}
					<div
						className="timeline-ruler-fixed"
						ref={rulerRef}
						onMouseDown={handleRulerMouseDown}
					>
						{/* Time scale with markers */}
						{Array.from(
							{ length: Math.ceil(duration / timeScaleUnit) + 1 },
							(_, i) => {
								const time = i * timeScaleUnit;
								return (
									<div
										key={i}
										className="ruler-mark"
										style={{
											left: `${time * pixelsPerSecond}px`,
										}}
									>
										<span className="ruler-label">
											{time >= 60
												? `${Math.floor(time / 60)}:${(
														time % 60
												  )
														.toString()
														.padStart(2, "0")}`
												: timeScaleUnit < 1
												? `${time.toFixed(1)}s`
												: `${time}s`}
										</span>
									</div>
								);
							}
						)}
					</div>

					{/* Scrollable tracks container */}
					<div
						className="timeline-tracks-scrollable"
						ref={timelineRef}
						onScroll={(e) => {
							const newScrollLeft = e.target.scrollLeft;
							setScrollLeft(newScrollLeft);
							// Sync the ruler scroll with the tracks scroll
							const rulerElement = document.querySelector(
								".timeline-ruler-fixed"
							);
							if (rulerElement) {
								rulerElement.scrollLeft = newScrollLeft;
							}
						}}
					>
						<div
							className="timeline-tracks-content"
							style={{
								width: `${Math.max(timelineWidth, 800)}px`,
								position: "relative",
								height: "100%",
							}}
						>
							{tracks.map((track, idx) => (
								<div
									key={track.id}
									className="timeline-track-content"
									ref={(el) => (trackRefs.current[idx] = el)}
									style={{
										height: "60px",
										borderBottom: "1px solid #333",
									}}
								>
									{track.clips.map((clip) =>
										renderClip(
											clip,
											track.id,
											track.type,
											idx
										)
									)}
								</div>
							))}
						</div>
					</div>
				</div>
			</div>

			{/* Draggable cursor - positioned relative to the scrollable content */}
			<div
				className="timeline-cursor"
				style={{
					position: "absolute",
					top: "64px", // Start from below the header controls and track headers
					left: `${
						200 + currentTime * pixelsPerSecond - scrollLeft
					}px`,
					height: "calc(100% - 64px)",
					width: "2px",
					background: "#ff0000",
					zIndex: 100,
					cursor: cursorDragging ? "grabbing" : "grab",
					pointerEvents: "none",
					display: `${
						currentTime * pixelsPerSecond - scrollLeft >= 0
							? "initial"
							: "none"
					}`,
				}}
			/>
		</div>
	);
};

export default TimelineEditor;
