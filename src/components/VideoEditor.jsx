import React, { useState, useRef, useEffect } from 'react';
import VideoPlayer from './VideoPlayer';
import TimelineEditor from './TimelineEditor';
import './VideoEditor.css';
import { getTimelineDuration } from '../utils/getTimelineDuration';
import { getTrackLastEnd } from '../utils/getTrackLastEnd';
import { checkForOverlaps } from '../utils/checkForOverlaps';

const VideoEditor = () => {
  const [tracks, setTracks] = useState([
    {
      id: 'video-1',
      type: 'video',
      name: 'Video Track 1',
      clips: [
        {
          id: 'clip-1',
          startTime: 0,
          duration: 10,
          source: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
          trimStart: 0,
          trimEnd: 10,
          crop: { x: 0, y: 0, width: 100, height: 100 },
          type: 'video'
        }
      ]
    },
    {
      id: 'audio-1',
      type: 'audio',
      name: 'Audio Track 1',
      clips: [
        {
          id: 'audio-clip-1',
          startTime: 0,
          duration: 10,
          source: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
          trimStart: 0,
          trimEnd: 10,
          volume: 1,
          type: 'audio'
        }
      ]
    }
  ]);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selectedClip, setSelectedClip] = useState(null);

  const videoRef = useRef(null);

  const handleTimeUpdate = (time) => {
    console.log('VideoEditor handleTimeUpdate called with time:', time);
    setCurrentTime(time);
  };

  const handleDurationChange = (duration) => {
    setDuration(duration);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time) => {
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleClipUpdate = (trackId, clipId, updates) => {
    setTracks(prevTracks => {
      // Remove from old track if _remove is set
      if (updates._remove) {
        return prevTracks.map(track =>
          track.id === trackId
            ? { ...track, clips: track.clips.filter(clip => clip.id !== clipId) }
            : track
        );
      }
      // If the clip doesn't exist in this track, add it
      const track = prevTracks.find(t => t.id === trackId);
      if (track && !track.clips.some(clip => clip.id === clipId)) {
        return prevTracks.map(t =>
          t.id === trackId
            ? { ...t, clips: [...t.clips, { ...updates, id: clipId }] }
            : t
        );
      }
      // Otherwise, update as usual
      return prevTracks.map(track =>
        track.id === trackId
          ? {
              ...track,
              clips: track.clips.map(clip =>
                clip.id === clipId ? { ...clip, ...updates } : clip
              ),
            }
          : track
      );
    });
  };

  // Updated handleClipMove with overlap prevention
  const handleClipMove = (trackId, clipId, newStartTime) => {
    const track = tracks.find(t => t.id === trackId);
    const clip = track?.clips.find(c => c.id === clipId);
    
    if (!clip) return;

    // Check if the new position would cause overlap
    if (checkForOverlaps(track, clipId, newStartTime, clip.duration)) {
      return; // Don't move if it would cause overlap
    }

    handleClipUpdate(trackId, clipId, { startTime: newStartTime });
  };

  const handleClipTrim = (trackId, clipId, trimStart, trimEnd) => {
    handleClipUpdate(trackId, clipId, { 
      trimStart, 
      trimEnd,
      duration: trimEnd - trimStart 
    });
  };

  const handleClipCrop = (trackId, clipId, crop) => {
    handleClipUpdate(trackId, clipId, { crop });
  };

  // Updated addClip with overlap prevention
  const addClip = (trackId, clipData) => {
    setTracks(prevTracks =>
      prevTracks.map(track => {
        if (track.id === trackId) {
          const lastEnd = getTrackLastEnd(track);
          const duration = clipData.duration || 5;
          return {
            ...track,
            clips: [
              ...track.clips,
              {
                id: `clip-${Date.now()}`,
                startTime: lastEnd,
                duration,
                source: clipData.source,
                trimStart: 0,
                trimEnd: duration,
                crop: { x: 0, y: 0, width: 100, height: 100 },
                volume: 1,
                type: track.type,
                ...clipData,
              },
            ],
          };
        }
        return track;
      })
    );
  };

  // Get the current clip data when selectedClip changes
  const getCurrentClipData = () => {
    if (!selectedClip) return null;
    
    const track = tracks.find(t => t.id === selectedClip.trackId);
    if (!track) return null;
    
    const clip = track.clips.find(c => c.id === selectedClip.clipId);
    return clip ? { ...clip, trackId: selectedClip.trackId, type: selectedClip.type } : null;
  };

  const currentClipData = getCurrentClipData();

  // Update selectedClip when clip data changes
  useEffect(() => {
    if (selectedClip && currentClipData) {
      setSelectedClip(prev => ({
        ...prev,
        ...currentClipData
      }));
    }
  }, [currentClipData]);

  // Updated handlePropertyChange with overlap prevention
  const handlePropertyChange = (property, value) => {
    if (!selectedClip) return;
    
    if (property === 'startTime' || property === 'duration') {
      const newStartTime = property === 'startTime' ? value : selectedClip.startTime;
      const newDuration = property === 'duration' ? value : selectedClip.duration;
      
      // Check for overlaps before applying the change
      if (checkForOverlaps(tracks.find(t => t.id === selectedClip.trackId), selectedClip.clipId, newStartTime, newDuration)) {
        return; // Don't apply the change if it would cause overlap
      }
    }
    
    if (property === 'crop') {
      handleClipCrop(selectedClip.trackId, selectedClip.clipId, value);
    } else {
      handleClipUpdate(selectedClip.trackId, selectedClip.clipId, { [property]: value });
    }
  };

  const addTrack = (type) => {
    const newTrack = {
      id: `${type}-${Date.now()}`,
      type,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Track ${tracks.filter(t => t.type === type).length + 1}`,
      clips: []
    };
    setTracks(prev => [...prev, newTrack]);
  };

  const timelineDuration = getTimelineDuration(tracks);

  return (
    <div className="video-editor">
      <div className="editor-header">
        <h1>Video Editor AI</h1>
        <div className="controls">
          <button onClick={handlePlayPause}>
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          <span className="progress-indicator">
            {currentTime.toFixed(2)} / {timelineDuration.toFixed(2)}
          </span>
          <div className="zoom-controls">
            <button onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}>-</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(Math.min(5, zoom + 0.1))}>+</button>
          </div>
        </div>
      </div>

      <div className="editor-main">
        <div className="player-section">
          <VideoPlayer
            ref={videoRef}
            tracks={tracks}
            currentTime={currentTime}
            isPlaying={isPlaying}
            duration={timelineDuration}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={handleDurationChange}
            onPlayPause={handlePlayPause}
          />
        </div>

        <div className="timeline-section">
          <TimelineEditor
            tracks={tracks}
            currentTime={currentTime}
            duration={timelineDuration}
            zoom={zoom}
            selectedClip={selectedClip}
            onClipSelect={setSelectedClip}
            onClipMove={handleClipMove}
            onClipTrim={handleClipTrim}
            onClipCrop={handleClipCrop}
            onAddTrack={addTrack}
            onAddClip={addClip}
            onSeek={handleSeek}
            onClipUpdate={handleClipUpdate}
            checkForOverlaps={checkForOverlaps}
          />
        </div>
      </div>

      {selectedClip && currentClipData && (
        <div className="clip-properties">
          <div className="properties-header">
            <h3>Clip Properties</h3>
            <button 
              className="close-btn"
              onClick={() => setSelectedClip(null)}
            >
              ×
            </button>
          </div>
          
          <div className="property-group">
            <label>Clip ID:</label>
            <span className="clip-id">{currentClipData.id}</span>
          </div>

          <div className="property-group">
            <label>Start Time:</label>
            <input
              type="number"
              step="0.1"
              value={currentClipData.startTime}
              onChange={(e) => handlePropertyChange('startTime', parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="property-group">
            <label>Duration:</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={currentClipData.duration}
              onChange={(e) => handlePropertyChange('duration', parseFloat(e.target.value) || 0.1)}
            />
          </div>

          <div className="property-group">
            <label>Trim Start:</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={currentClipData.trimStart}
              onChange={(e) => handlePropertyChange('trimStart', parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="property-group">
            <label>Trim End:</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={currentClipData.trimEnd}
              onChange={(e) => handlePropertyChange('trimEnd', parseFloat(e.target.value) || 0)}
            />
          </div>

          {currentClipData.type === 'video' && (
            <div className="property-group">
              <label>Crop:</label>
              <div className="crop-controls">
                <div className="crop-row">
                  <label>X:</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={currentClipData.crop?.x || 0}
                    onChange={(e) => handlePropertyChange('crop', {
                      ...currentClipData.crop,
                      x: parseFloat(e.target.value) || 0
                    })}
                  />
                </div>
                <div className="crop-row">
                  <label>Y:</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={currentClipData.crop?.y || 0}
                    onChange={(e) => handlePropertyChange('crop', {
                      ...currentClipData.crop,
                      y: parseFloat(e.target.value) || 0
                    })}
                  />
                </div>
                <div className="crop-row">
                  <label>Width:</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max="100"
                    value={currentClipData.crop?.width || 100}
                    onChange={(e) => handlePropertyChange('crop', {
                      ...currentClipData.crop,
                      width: parseFloat(e.target.value) || 100
                    })}
                  />
                </div>
                <div className="crop-row">
                  <label>Height:</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max="100"
                    value={currentClipData.crop?.height || 100}
                    onChange={(e) => handlePropertyChange('crop', {
                      ...currentClipData.crop,
                      height: parseFloat(e.target.value) || 100
                    })}
                  />
                </div>
              </div>
            </div>
          )}

          {currentClipData.type === 'audio' && (
            <div className="property-group">
              <label>Volume:</label>
              <div className="volume-control">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={currentClipData.volume || 1}
                  onChange={(e) => handlePropertyChange('volume', parseFloat(e.target.value))}
                />
                <span className="volume-value">{(currentClipData.volume || 1).toFixed(1)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoEditor; 