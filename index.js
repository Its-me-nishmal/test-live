const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

// Set the path to the video file (your sample.mp4)
const videoFilePath = path.join(__dirname, 'sample.mp4');

// Set your YouTube stream key directly here
const youtubeStreamKey = 'su9z-j176-664y-47wb-1zq4';

// FFmpeg function to stream to YouTube
function streamToYouTube() {
  const youtubeStreamUrl = `rtmp://a.rtmp.youtube.com/live2/${youtubeStreamKey}`;

  ffmpeg(videoFilePath)
    .inputOptions('-re') // Stream in real-time
    .addOption('-stream_loop', '-1') // Loop the video indefinitely
    .addOption('-c:v', 'libx264') // Use H.264 codec for video
    .addOption('-preset', 'veryfast') // Set encoding preset to reduce latency
    .addOption('-maxrate', '3000k') // Max bitrate
    .addOption('-bufsize', '6000k') // Buffer size
    .addOption('-pix_fmt', 'yuv420p') // Pixel format
    .addOption('-g', '50') // Keyframe interval
    .addOption('-c:a', 'aac') // Use AAC codec for audio
    .addOption('-b:a', '128k') // Audio bitrate
    .addOption('-ar', '44100') // Audio sample rate
    .addOption('-f', 'flv') // Format for streaming (YouTube uses FLV)
    .output(youtubeStreamUrl)
    .on('start', (commandLine) => {
      console.log('FFmpeg process started with command:', commandLine);
    })
    .on('error', (err) => {
      console.error('Error occurred during streaming:', err.message);
    })
    .on('end', () => {
      console.log('Streaming finished.');
    })
    .run();
}

// Start the stream
streamToYouTube();
