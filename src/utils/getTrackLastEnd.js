/**
 * Returns the end time of the last clip in a track.
 * @param {Object} track - The track object.
 * @returns {number}
 */
export function getTrackLastEnd(track) {
  if (!track.clips.length) return 0;
  return Math.max(...track.clips.map(c => c.startTime + c.duration));
} 