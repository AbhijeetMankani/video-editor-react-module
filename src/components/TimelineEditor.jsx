import React, { useState, useRef, useEffect } from 'react';
import './TimelineEditor.css';
import { checkForOverlaps } from '../utils/checkForOverlaps';

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
  onSeek,
  onClipUpdate,
  checkForOverlaps
}) => {
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [cursorDragging, setCursorDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartY, setDragStartY] = useState(0);
  const [originalStartTime, setOriginalStartTime] = useState(0);
  const [originalDuration, setOriginalDuration] = useState(0);
  const timelineRef = useRef(null);
  const trackRefs = useRef([]);
  const rulerRef = useRef(null);

  const pixelsPerSecond = 50 * zoom;
  const timelineWidth = duration * pixelsPerSecond;

  const handleRulerMouseDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Immediately move cursor to clicked position
    const rect = rulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX - 200) / pixelsPerSecond; // Account for track header offset
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
      setResizing({ clip, trackId, side: 'start' });
      setDragStartX(e.clientX);
      setOriginalStartTime(clip.startTime);
      setOriginalDuration(clip.duration);
    } else if (clickX > clipWidth - 10) {
      setResizing({ clip, trackId, side: 'end' });
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
      const clickX = e.clientX - rect.left;
      
      // Only move cursor if mouse is still over the ruler area
      if (clickX >= 0 && clickX <= rect.width) {
        const newTime = (clickX - 200) / pixelsPerSecond; // Account for track header offset
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
      if (!checkForOverlaps(targetTrack, dragging.clip.id, newStartTime, dragging.clip.duration)) {
        if (newTrackId !== dragging.trackId) {
          onClipUpdate(dragging.trackId, dragging.clip.id, { _remove: true });
          onClipUpdate(newTrackId, dragging.clip.id, {
            ...dragging.clip,
            startTime: newStartTime,
            type: newTrackType,
          });
          setDragging({ ...dragging, trackId: newTrackId, trackIdx: newTrackIdx });
        } else {
          onClipUpdate(dragging.trackId, dragging.clip.id, { startTime: newStartTime });
        }
      }
    }
    if (resizing) {
      const deltaX = e.clientX - dragStartX;
      const deltaTime = deltaX / pixelsPerSecond;
      const track = tracks.find(t => t.id === resizing.trackId);
      if (!track) return;

      if (resizing.side === 'start') {
        let newStartTime = originalStartTime + deltaTime;
        let newDuration = originalDuration - deltaTime;
        if (newDuration < MIN_DURATION) {
          newStartTime = originalStartTime + (originalDuration - MIN_DURATION);
          newDuration = MIN_DURATION;
        }
        if (newStartTime < 0) {
          newStartTime = 0;
          newDuration = originalStartTime + originalDuration;
        }
        if (!checkForOverlaps(track, resizing.clip.id, newStartTime, newDuration)) {
          onClipUpdate(resizing.trackId, resizing.clip.id, {
            startTime: newStartTime,
            duration: newDuration,
          });
        }
      } else if (resizing.side === 'end') {
        let newDuration = originalDuration + deltaTime;
        if (newDuration < MIN_DURATION) newDuration = MIN_DURATION;
        if (!checkForOverlaps(track, resizing.clip.id, originalStartTime, newDuration)) {
          onClipUpdate(resizing.trackId, resizing.clip.id, {
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
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, resizing, cursorDragging, dragStartX, originalStartTime, originalDuration]);

  const renderClip = (clip, trackId, trackType, trackIdx) => {
    const clipLeft = clip.startTime * pixelsPerSecond;
    const clipWidth = clip.duration * pixelsPerSecond;
    const isSelected = selectedClip?.clipId === clip.id;

    return (
      <div
        key={clip.id}
        className={`timeline-clip ${trackType} ${isSelected ? 'selected' : ''}`}
        style={{
          left: `${clipLeft}px`,
          width: `${clipWidth}px`,
        }}
        onMouseDown={(e) => handleClipMouseDown(e, clip, trackId, trackIdx)}
        onClick={(e) => {
          e.stopPropagation();
          onClipSelect({ clipId: clip.id, trackId, type: trackType, ...clip });
          // Move cursor to the beginning of the clip
          // onSeek(clip.startTime);
        }}
      >
        <div className="clip-content">
          <div className="clip-name">
            {trackType === 'video' ? '🎥' : '🎵'} {clip.id}
          </div>
          <div className="clip-duration">
            {clip.duration.toFixed(1)}s
          </div>
        </div>
        <div className="resize-handle left" />
        <div className="resize-handle right" />
      </div>
    );
  };

  const renderTrack = (track, idx) => (
    <div
      key={track.id}
      className="timeline-track"
      ref={el => (trackRefs.current[idx] = el)}
    >
      <div className="track-header">
        <span className="track-name">{track.name}</span>
        <button 
          className="add-clip-btn"
          onClick={() => {
            const newClip = {
              source: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
              duration: 5,
              volume: 1
            };
            onAddClip(track.id, newClip);
          }}
        >
          +
        </button>
      </div>
      <div className="track-content">
        {track.clips.map(clip => renderClip(clip, track.id, track.type, idx))}
      </div>
    </div>
  );

  return (
    <div className="timeline-editor" style={{ position: 'relative' }}>
      <div className="timeline-header">
        <div className="timeline-controls">
          <button onClick={() => onAddTrack('video')}>Add Video Track</button>
          <button onClick={() => onAddTrack('audio')}>Add Audio Track</button>
        </div>
        <div 
          className="timeline-ruler"
          ref={rulerRef}
          onMouseDown={handleRulerMouseDown}
        >
          {/* Time scale with markers */}
          {Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => (
            <div
              key={i}
              className="ruler-mark"
              style={{ left: `${200 + (i * pixelsPerSecond)}px` }}
            >
              <span className="ruler-label">{i}s</span>
            </div>
          ))}
        </div>
      </div>

      <div className="timeline-content" style={{ position: 'relative', overflowX: 'auto' }}>
        <div
          ref={timelineRef}
          className="timeline-scroll-area"
          style={{
            width: '100%',
            position: 'relative',
            height: '100%',
            background: 'transparent',
          }}
        >
          <div className="tracks-container">
            {tracks.map(renderTrack)}
          </div>
        </div>
      </div>
      
      {/* Draggable cursor - extends from time scale down through tracks */}
      <div
        className="timeline-cursor"
        style={{
          position: 'absolute',
          top: '60px', // Start from below the add track buttons, above the time scale
          left: `${200 + (currentTime * pixelsPerSecond)}px`,
          height: 'calc(100% - 60px)', // Height from time scale to bottom
          width: '2px',
          background: '#ff0000',
          zIndex: 100,
          cursor: cursorDragging ? 'grabbing' : 'grab',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};

export default TimelineEditor; 