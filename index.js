const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Configuration Variables
const GOOGLE_SHEET_URL = 'https://script.googleusercontent.com/macros/echo?user_content_key=jrY6qgcIP0HclGr9W22qvj5h6WNkSG2yZRoIqKWQK9XMRTSBwYotjMZjavLa99F0QwDPZKvjjDZl9QU5FT0RP42aovy3fRUUm5_BxDlH2jW0nuo2oDemN9CCS2h10ox_1xSncGQajx_ryfhECjZEnC_lH6Xes5sj60JYhGEpjf2RIE1hP9cK6jI0Ln1fsVsK0LcP46IkpFL8F9V7EmWWl2Qm3wh0R6cbKFXj2yb-_wPsOF67hWI8cNz9Jw9Md8uu&lib=MJrc9AgLu8ITr5HB7zZTL_mIm8UQkONTv'; // Your Google Apps Script URL
const OVERLAY_FILE = path.join(__dirname, 'overlay.txt'); // Text file to store the overlay text
const MP3_FILE = path.join(__dirname, 'sample.mp3'); // Path to the MP3 audio file
const BACKGROUND_IMAGE = path.join(__dirname, 'bg.png'); // Path to the static black background image
const STREAM_KEY = 'g0qj-3f62-utg1-v0u8-72p3'; // Your YouTube stream key
const PORT = process.env.PORT || 3000; // HTTP server port
const youtubeStreamUrl = `rtmp://a.rtmp.youtube.com/live2/${STREAM_KEY}`; // YouTube RTMP URL with stream key

// Fetch Data from Google Apps Script
async function fetchYouTubeData() {
  try {
    const response = await axios.get(GOOGLE_SHEET_URL);
    const data = response.data;

    // Prepare the overlay text
    const overlayText = `
      Viewer Count: ${data.viewerCount || 'N/A'}
      Likes: ${data.likes || 'N/A'}
      Subscriber Count: ${data.subscriberCount || 'N/A'}
    `;

    // Write the overlay text to the file
    fs.writeFileSync(OVERLAY_FILE, overlayText.trim(), 'utf8');
    console.log(`Overlay updated: ${overlayText.trim()}`);
  } catch (error) {
    console.error('Error fetching YouTube data:', error.message);
  }
}

// Start FFmpeg to Stream with Static Background Image and Overlay
function startFFmpeg() {
  ffmpeg()
    .input(BACKGROUND_IMAGE) // Use the static black background image as the video input
    .input(MP3_FILE) // Audio input (MP3 file)
    .inputOptions(['-stream_loop -1', '-re']) // Loop audio and real-time flag
    .complexFilter([
      // Overlay text data (reload the overlay file every second)
      `drawtext=textfile=${OVERLAY_FILE}:reload=1:fontcolor=white:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2`
    ])
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
    .output(youtubeStreamUrl) // Output to YouTube
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

// Update overlay and restart FFmpeg every minute
function updateOverlayAndStream() {
  fetchYouTubeData(); // Fetch YouTube data
  setInterval(fetchYouTubeData, 60 * 1000); // Fetch data every minute

  // Start FFmpeg streaming
  startFFmpeg();
}

// Run the update and stream process
updateOverlayAndStream();

// Create a simple HTTP server to keep the app alive
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('The stream is live!\n');
}).listen(PORT, () => {
  console.log(`HTTP server running on port ${PORT}`);
});
