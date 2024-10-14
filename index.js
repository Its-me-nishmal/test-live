const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const http = require('http');

// Set the path to the video file (your sample.mp4)
const videoFilePath = path.join(__dirname, 'sample.mp4');

// Set your YouTube stream key directly here
const youtubeStreamKey = 'wzb2-5u6t-c13w-mkwx-1j49';

// Function to stream to YouTube
function streamToYouTube() {
  const youtubeStreamUrl = `rtmp://a.rtmp.youtube.com/live2/${youtubeStreamKey}`;

  ffmpeg()
    .input(videoFilePath)
    .inputOptions(['-stream_loop -1', '-re']) // Corrected placement of input options
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

// Start streaming when the script is executed
streamToYouTube();

// Create an HTTP server to keep the app alive
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('The stream is live!\n');
});

// Listen on port 3000 or the port provided by the environment (e.g., Render)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`HTTP server is running on port ${PORT}`);
});
