/**
 * Returns true if the given clip (by id) would overlap with any other clip in the track.
 * @param {Object} track - The track object containing clips.
 * @param {string} clipId - The id of the clip being moved/resized.
 * @param {number} newStartTime - The proposed start time.
 * @param {number} newDuration - The proposed duration.
 * @returns {boolean}
 */
export function checkForOverlaps(track, clipId, newStartTime, newDuration) {
  const newEndTime = newStartTime + newDuration;
  return track.clips.some(clip => {
    if (clip.id === clipId) return false;
    const clipEndTime = clip.startTime + clip.duration;
    return newStartTime < clipEndTime && newEndTime > clip.startTime;
  });
} 