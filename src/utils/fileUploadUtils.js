// Simple file upload utilities for video and audio files
export const createFileInput = (accept, onFileSelect) => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.style.display = 'none';
  
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      onFileSelect(file);
    }
    // Clean up
    document.body.removeChild(input);
  });
  
  document.body.appendChild(input);
  input.click();
};

export const getVideoDuration = (file) => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      resolve(video.duration);
      URL.revokeObjectURL(video.src);
    };
    
    video.onerror = () => {
      console.error('Error loading video metadata');
      resolve(10); // Default duration
      URL.revokeObjectURL(video.src);
    };
    
    video.src = URL.createObjectURL(file);
  });
};

export const getAudioDuration = (file) => {
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    
    audio.onloadedmetadata = () => {
      resolve(audio.duration);
      URL.revokeObjectURL(audio.src);
    };
    
    audio.onerror = () => {
      console.error('Error loading audio metadata');
      resolve(10); // Default duration
      URL.revokeObjectURL(audio.src);
    };
    
    audio.src = URL.createObjectURL(file);
  });
};

export const processVideoFile = async (file) => {
  try {
    const url = URL.createObjectURL(file);
    const duration = await getVideoDuration(file);
    
    return {
      url,
      duration,
      originalFile: file,
      name: file.name
    };
  } catch (error) {
    console.error('Error processing video file:', error);
    throw error;
  }
};

export const processAudioFile = async (file) => {
  try {
    const url = URL.createObjectURL(file);
    const duration = await getAudioDuration(file);
    
    return {
      url,
      duration,
      originalFile: file,
      name: file.name
    };
  } catch (error) {
    console.error('Error processing audio file:', error);
    throw error;
  }
}; 