const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration Variables
const GOOGLE_SHEET_URL = 'https://script.googleusercontent.com/macros/echo?user_content_key=jrY6qgcIP0HclGr9W22qvj5h6WNkSG2yZRoIqKWQK9XMRTSBwYotjMZjavLa99F0QwDPZKvjjDZl9QU5FT0RP42aovy3fRUUm5_BxDlH2jW0nuo2oDemN9CCS2h10ox_1xSncGQajx_ryfhECjZEnC_lH6Xes5sj60JYhGEpjf2RIE1hP9cK6jI0Ln1fsVsK0LcP46IkpFL8F9V7EmWWl2Qm3wh0R6cbKFXj2yb-_wPsOF67hWI8cNz9Jw9Md8uu&lib=MJrc9AgLu8ITr5HB7zZTL_mIm8UQkONTv'; // Replace with your Google Apps Script URL
const OVERLAY_FILE = path.join(__dirname, 'overlay.txt'); // Text file to store the overlay text
const MP3_FILE = path.join(__dirname, 'sample.mp3'); // Path to the MP3 audio file
const STREAM_KEY = 'su9z-j176-664y-47wb-1zq4'; // Replace with your YouTube stream key

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

// Start FFmpeg to Stream with Animated Gradient Background and Overlay
function startFFmpeg() {
  ffmpeg()
    .input('color=black:size=1280x720:rate=30') // Generate a black background at 1280x720 resolution
    .input(MP3_FILE) // Audio input (MP3 file)
    .complexFilter([
      // Gradient Animation for Background
      'geq=lum=\'128+128*sin(2*PI*t/10)\':cb=128:cr=128',
      // Overlay text data (reload the overlay file every second)
      `drawtext=textfile=${OVERLAY_FILE}:reload=1:fontcolor=white:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2`
    ])
    .outputOptions([
      '-c:v libx264',           // Video codec: H.264
      '-preset veryfast',        // Faster encoding
      '-maxrate 3000k',          // Maximum bitrate
      '-bufsize 6000k',          // Buffer size
      '-pix_fmt yuv420p',        // Pixel format
      '-g 50',                   // Keyframe interval
      '-c:a aac',                // Audio codec: AAC
      '-b:a 128k',               // Audio bitrate
      '-ar 44100',               // Audio sample rate
      '-f flv'                   // Streaming format: FLV
    ])
    .output(`rtmp://a.rtmp.youtube.com/live2/${STREAM_KEY}`) // YouTube RTMP URL with stream key
    .on('start', () => {
      console.log('FFmpeg process started');
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
