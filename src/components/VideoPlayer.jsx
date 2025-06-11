import React, { forwardRef, useEffect, useRef } from 'react';
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

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!canvas || !ctx) return;

    const renderFrame = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Get current clips for the current time
      const currentClips = tracks.flatMap(track => 
        track.clips.filter(clip => 
          currentTime >= clip.startTime && 
          currentTime < clip.startTime + clip.duration
        ).map(clip => ({ ...clip, trackType: track.type }))
      );

      // Render video clips
      const videoClips = currentClips.filter(clip => clip.trackType === 'video');
      if (videoClips.length > 0) {
        const topVideoClip = videoClips[videoClips.length - 1]; // Top layer
        const videoElement = videoElementsRef.current[topVideoClip.id];
        
        if (videoElement && videoElement.readyState >= 2) {
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

      // Handle audio
      const audioClips = currentClips.filter(clip => clip.trackType === 'audio');
      audioClips.forEach(clip => {
        const audioElement = audioElementsRef.current[clip.id];
        if (audioElement) {
          audioElement.volume = clip.volume || 1;
          if (isPlaying && audioElement.paused) {
            audioElement.play().catch(console.error);
          } else if (!isPlaying && !audioElement.paused) {
            audioElement.pause();
          }
        }
      });
    };

    const interval = setInterval(renderFrame, 1000 / 30); // 30 FPS
    return () => clearInterval(interval);
  }, [tracks, currentTime, isPlaying]);

  useEffect(() => {
    // Create video and audio elements for each clip
    tracks.forEach(track => {
      track.clips.forEach(clip => {
        if (track.type === 'video') {
          if (!videoElementsRef.current[clip.id]) {
            const video = document.createElement('video');
            video.src = clip.source;
            video.muted = true;
            video.loop = true;
            videoElementsRef.current[clip.id] = video;
          }
        } else if (track.type === 'audio') {
          if (!audioElementsRef.current[clip.id]) {
            const audio = document.createElement('audio');
            audio.src = clip.source;
            audio.loop = true;
            audioElementsRef.current[clip.id] = audio;
          }
        }
      });
    });

    return () => {
      // Cleanup
      Object.values(videoElementsRef.current).forEach(video => video.remove());
      Object.values(audioElementsRef.current).forEach(audio => audio.remove());
      videoElementsRef.current = {};
      audioElementsRef.current = {};
    };
  }, [tracks]);

  useEffect(() => {
    // Update video and audio current times
    Object.values(videoElementsRef.current).forEach(video => {
      video.currentTime = currentTime;
    });
    Object.values(audioElementsRef.current).forEach(audio => {
      audio.currentTime = currentTime;
    });
  }, [currentTime]);

  // Timer effect to move cursor when playing
  useEffect(() => {
    let interval;
    if (isPlaying) {
      console.log('Starting timer, currentTime:', currentTime, 'duration:', duration);
      interval = setInterval(() => {
        const newTime = currentTime + 0.1; // Update every 100ms for smooth movement
        console.log('Timer tick, newTime:', newTime, 'duration:', duration);
        if (newTime >= duration) {
          // Stop playing when reaching the end
          console.log('Reached end, stopping playback');
          onTimeUpdate(duration);
          onPlayPause(); // This will set isPlaying to false
        } else {
          console.log('Updating time to:', newTime);
          onTimeUpdate(newTime);
        }
      }, 100);
    } else {
      console.log('Stopping timer, isPlaying:', isPlaying);
    }
    return () => {
      if (interval) {
        console.log('Clearing timer interval');
        clearInterval(interval);
      }
    };
  }, [isPlaying, currentTime, duration, onTimeUpdate, onPlayPause]);

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
      </div>
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer; 