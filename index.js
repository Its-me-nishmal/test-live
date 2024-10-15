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
const STREAM_KEY = 'su9z-j176-664y-47wb-1zq4'; // Your YouTube stream key
const PORT = process.env.PORT || 3000; // HTTP server port

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
    .complexFilter([
      // Overlay text data (reload the overlay file every second)
      `drawtext=textfile=${OVERLAY_FILE}:reload=1:fontcolor=white:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2`
    ])
    .outputOptions([
      '-c:v libx264',           // Video codec: H.264
      '-preset veryfast',        // Faster encoding
      '-maxrate 3000k',          // Maximum bitrate
      '-bufsize 6000k',          // Buffer size
      '-pix_fmt yuv420p',        // Pixel format
      '-g 50',                   // Keyframe interval (change if necessary)
      '-c:a aac',                // Audio codec: AAC
      '-b:a 128k',               // Audio bitrate
      '-ar 44100',               // Audio sample rate
      '-f flv'                   // Streaming format: FLV
    ])
    .output(`rtmp://a.rtmp.youtube.com/live2/${STREAM_KEY}`) // YouTube RTMP URL with stream key
    .on('start', () => {
      console.log('FFmpeg process started');
    })
    .on('stderr', (stderrLine) => {
      console.log('FFmpeg stderr:', stderrLine); // Log FFmpeg's stderr to get detailed logs
    })
    .on('error', (err) => {
      console.error('Error during streaming:', err.message);
    })
    .on('end', () => {
      console.log('Streaming ended.');
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
