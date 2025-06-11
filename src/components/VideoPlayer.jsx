import React, { forwardRef, useEffect, useRef, useState } from 'react';
import './VideoPlayer.css';

const VideoPlayer = forwardRef(({ 
  tracks, 
  currentTime, 
  isPlaying, 
  duration,
  onTimeUpdate, 
  onDurationChange, 
  onPlayPause
}, ref) => {
  const canvasRef = useRef(null);
  const videoElementsRef = useRef({});
  const audioElementsRef = useRef({});
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // Local state for playback speed
  // const clipPlayingStateRef = useRef(new Map()); // Removed: ref to track individual clip playback state
  // const activeMediaElementRef = useRef(null); // Removed: New ref to track the currently active playing media element

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!canvas || !ctx) return;

    const renderFrame = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Find the topmost video clip at the current time by checking tracks in order
      let topVideoClip = null;
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (track.type === 'video') {
          const currentClip = track.clips.find(clip => 
            currentTime >= clip.startTime && 
            currentTime < clip.startTime + clip.duration
          );
          if (currentClip) {
            topVideoClip = { ...currentClip, trackType: track.type };
            break; // Found the topmost video clip
          }
        }
      }

      // Render the topmost video clip
      if (topVideoClip) {
        const videoElement = videoElementsRef.current[topVideoClip.id];
        
        if (videoElement && videoElement.readyState >= 2) {
          // Don't set currentTime here - it causes video seeking and black flashes
          // The video element will play continuously and stay in sync naturally
          
          // Apply crop transformation
          const crop = topVideoClip.crop || { x: 0, y: 0, width: 100, height: 100 };
          const sourceX = (videoElement.videoWidth * crop.x) / 100;
          const sourceY = (videoElement.videoHeight * crop.y) / 100;
          const sourceWidth = (videoElement.videoWidth * crop.width) / 100;
          const sourceHeight = (videoElement.videoHeight * crop.height) / 100;

          ctx.drawImage(
            videoElement,
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, canvas.width, canvas.height
          );
        }
      }

      // Handle audio clips: only set volume, currentTime is handled by playback control
      tracks.forEach(track => {
        if (track.type === 'audio') {
          const currentClip = track.clips.find(clip => 
            currentTime >= clip.startTime && 
            currentTime < clip.startTime + clip.duration
          );
          
          if (currentClip) {
            const audioElement = audioElementsRef.current[currentClip.id];
            if (audioElement) {
              audioElement.volume = currentClip.volume || 1;
              
              // Don't set currentTime here - it causes audio interruptions
              // The audio elements will play continuously and stay in sync naturally
            }
          }
        }
      });
    };

    const interval = setInterval(renderFrame, 1000 / (24 * playbackSpeed)); // Adjust FPS based on playback speed
    return () => clearInterval(interval);
  }, [tracks, currentTime, playbackSpeed]); // Removed isPlaying from dependencies

  useEffect(() => {
    // Create video and audio elements for each clip
    tracks.forEach(track => {
      track.clips.forEach(clip => {
        if (track.type === 'video') {
          if (!videoElementsRef.current[clip.id]) {
            const video = document.createElement('video');
            video.src = clip.source;
            video.muted = true;
            video.loop = false; // Don't loop, we'll control playback manually
            video.preload = 'auto'; // Preload more data for better slow playback
            videoElementsRef.current[clip.id] = video;
          }
        } else if (track.type === 'audio') {
          if (!audioElementsRef.current[clip.id]) {
            const audio = document.createElement('audio');
            audio.src = clip.source;
            audio.loop = false; // Don't loop, we'll control playback manually
            audio.preload = 'auto'; // Preload more data for better slow playback
            audioElementsRef.current[clip.id] = audio;
          }
        }
      });
    });

    return () => {
      // Cleanup: Identify and remove elements for clips that are no longer in tracks
      const currentClipIds = new Set();
      tracks.forEach(track => track.clips.forEach(clip => currentClipIds.add(clip.id)));

      // Clean up video elements no longer in tracks
      Object.keys(videoElementsRef.current).forEach(clipId => {
        if (!currentClipIds.has(clipId)) {
          videoElementsRef.current[clipId].pause(); // Pause before removing
          videoElementsRef.current[clipId].remove();
          delete videoElementsRef.current[clipId];
        }
      });

      // Clean up audio elements no longer in tracks
      Object.keys(audioElementsRef.current).forEach(clipId => {
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
      ...Object.keys(audioElementsRef.current)
    ]);

    // Handle global pause
    if (!isPlaying) {
      allLoadedMediaIds.forEach(clipId => {
        const mediaElement = videoElementsRef.current[clipId] || audioElementsRef.current[clipId];
        if (mediaElement && !mediaElement.paused) {
          mediaElement.pause();
        }
      });
      return;
    }

    // If playing, manage active clips
    const currentlyActiveClipIds = new Set();
    tracks.forEach(track => {
        track.clips.forEach(clip => {
            if (currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
                currentlyActiveClipIds.add(clip.id);
            }
        });
    });

    allLoadedMediaIds.forEach(clipId => {
      const mediaElement = videoElementsRef.current[clipId] || audioElementsRef.current[clipId];
      if (!mediaElement) return; 

      // Update playback rate
      mediaElement.playbackRate = playbackSpeed;

      const shouldBeActive = currentlyActiveClipIds.has(clipId);
      const isCurrentlyPlaying = !mediaElement.paused;

      if (shouldBeActive && !isCurrentlyPlaying) {
        if (mediaElement.readyState >= 2) {
          // Set initial time and start playing
          const clip = tracks.flatMap(t => t.clips).find(c => c.id === clipId);
          if (clip) {
            const clipTime = currentTime - clip.startTime + clip.trimStart;
            mediaElement.currentTime = clipTime;
          }
          mediaElement.play().catch(e => console.error(`Error playing clip ${clipId}:`, e));
        }
      } else if (!shouldBeActive && isCurrentlyPlaying) {
        mediaElement.pause();
      }
    });

  }, [isPlaying, tracks, currentTime, playbackSpeed]);

  // Timer effect to move cursor when playing
  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        const newTime = currentTime + (0.1 * playbackSpeed); // Update current time based on speed
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
  }, [isPlaying, currentTime, duration, onTimeUpdate, onPlayPause, playbackSpeed]);

  return (
    <div className="video-player">
      <canvas
        ref={canvasRef}
        width={640}
        height={360}
        className="video-canvas"
      />
      <div className="player-controls">
        <button onClick={onPlayPause}>
          {isPlaying ? '⏸️ Pause' : '▶️ Play'}
        </button>
        <div className="time-display">
          {Math.floor(currentTime)}s
        </div>
        <div className="playback-speed-controls">
          <label htmlFor="playback-speed">Speed:</label>
          <select
            id="playback-speed"
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
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
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer; 