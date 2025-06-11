import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

let ffmpeg = null;

export const initFFmpeg = async () => {
  if (ffmpeg) return ffmpeg;
  
  ffmpeg = new FFmpeg();
  
  // Load FFmpeg WASM
  await ffmpeg.load({
    coreURL: await toBlobURL('/ffmpeg-core.js', 'text/javascript'),
    wasmURL: await toBlobURL('/ffmpeg-core.wasm', 'application/wasm'),
  });
  
  return ffmpeg;
};

export const processVideoFile = async (file) => {
  try {
    const ffmpegInstance = await initFFmpeg();
    
    // Write the uploaded file to FFmpeg's virtual filesystem
    await ffmpegInstance.writeFile('input.mp4', await fetchFile(file));
    
    // Get video information
    await ffmpegInstance.exec(['-i', 'input.mp4', '-f', 'null', '-']);
    
    // Read the processed file
    const data = await ffmpegInstance.readFile('input.mp4');
    
    // Create a blob URL for the processed video
    const blob = new Blob([data], { type: file.type });
    const url = URL.createObjectURL(blob);
    
    return {
      url,
      duration: await getVideoDuration(ffmpegInstance, 'input.mp4'),
      originalFile: file
    };
  } catch (error) {
    console.error('Error processing video file:', error);
    throw error;
  }
};

export const processAudioFile = async (file) => {
  try {
    const ffmpegInstance = await initFFmpeg();
    
    // Write the uploaded file to FFmpeg's virtual filesystem
    await ffmpegInstance.writeFile('input.mp3', await fetchFile(file));
    
    // Get audio information
    await ffmpegInstance.exec(['-i', 'input.mp3', '-f', 'null', '-']);
    
    // Read the processed file
    const data = await ffmpegInstance.readFile('input.mp3');
    
    // Create a blob URL for the processed audio
    const blob = new Blob([data], { type: file.type });
    const url = URL.createObjectURL(blob);
    
    return {
      url,
      duration: await getAudioDuration(ffmpegInstance, 'input.mp3'),
      originalFile: file
    };
  } catch (error) {
    console.error('Error processing audio file:', error);
    throw error;
  }
};

const getVideoDuration = async (ffmpegInstance, filename) => {
  try {
    await ffmpegInstance.exec([
      '-i', filename,
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format'
    ]);
    
    // This is a simplified approach - in a real implementation,
    // you'd parse the FFmpeg output to get duration
    return 10; // Default duration for now
  } catch (error) {
    console.error('Error getting video duration:', error);
    return 10;
  }
};

const getAudioDuration = async (ffmpegInstance, filename) => {
  try {
    await ffmpegInstance.exec([
      '-i', filename,
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format'
    ]);
    
    // This is a simplified approach - in a real implementation,
    // you'd parse the FFmpeg output to get duration
    return 10; // Default duration for now
  } catch (error) {
    console.error('Error getting audio duration:', error);
    return 10;
  }
};

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