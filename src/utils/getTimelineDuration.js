/**
 * Returns the maximum end time of all clips in all tracks (i.e., the timeline duration).
 * @param {Array} tracks - Array of track objects.
 * @param {number} [minDuration=0] - Optional minimum duration.
 * @returns {number}
 */
export function getTimelineDuration(tracks, minDuration = 0) {
  let maxEnd = 0;
  tracks.forEach(track => {
    track.clips.forEach(clip => {
      const end = clip.startTime + clip.duration;
      if (end > maxEnd) maxEnd = end;
    });
  });
  return Math.max(maxEnd, minDuration);
} 