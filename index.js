const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Configuration Variables
const GOOGLE_SHEET_URL = 'https://script.googleusercontent.com/macros/echo?user_content_key=r8aMoxBJgXauIey3dkWzvxkb4OqOzxyr017m43ve204mDGDX-lzbPUQjHpWN4HXpth5hpP5jko1bPx7BXL4olqcoJyYetRvhm5_BxDlH2jW0nuo2oDemN9CCS2h10ox_1xSncGQajx_ryfhECjZEnPEC6EVWrQsyKm0cmRTr8CaiJZfdbLJZmabY-VkeKC7CaRtdECQE7PafMf8zGbI3l75LxStYuf8i3rEfpoDChNbNJVnIF2IHQ9z9Jw9Md8uu&lib=MJrc9AgLu8ITr5HB7zZTL_mIm8UQkONTv'; // Your Google Apps Script URL
const OVERLAY_FILE = path.join(__dirname, 'overlay.txt'); // Text file to store the overlay text
const MP3_FILE = path.join(__dirname, 'sample.mp3'); // Path to the MP3 audio file
const BACKGROUND_IMAGE = path.join(__dirname, 'bg.png'); // Path to the static background image
const STREAM_KEY = 'w5mf-vzsh-b1cm-t8kc-22h7'; // Your YouTube stream key
const youtubeStreamUrl = `rtmp://a.rtmp.youtube.com/live2/${STREAM_KEY}`; // YouTube RTMP URL with stream key
const PORT = process.env.PORT || 10000; // HTTP server port

// Function to generate overlay text with color
function generateOverlayText(data) {
  // Generate contrasting colors
  const darkColors = ['black', 'dimgray', 'darkslategray', 'gray', 'maroon'];
  const lightColors = ['white', 'lightgray', 'ivory', 'yellow', 'lightyellow'];

  const backgroundColor = darkColors[Math.floor(Math.random() * darkColors.length)];
  const textColor = lightColors[Math.floor(Math.random() * lightColors.length)];

  const overlayText = `
  Live Viewer Count: ${data.viewerCount || 'N/A'}\nLikes: ${data.likes || 'N/A'}\nSubscribers: ${data.subscriberCount || 'N/A'}
  `;

  return overlayText.trim();
}

// Function to fetch data from Google Sheets and update the overlay text file
async function fetchYouTubeData() {
  try {
    const response = await axios.get(GOOGLE_SHEET_URL);
    const data = response.data;

    const overlayText = generateOverlayText(data);

    // Write the overlay text to the file
    fs.writeFileSync(OVERLAY_FILE, overlayText, 'utf8');
    console.log(`Overlay updated: ${overlayText}`);
  } catch (error) {
    console.error('Error fetching YouTube data:', error.message);
  }
}

// Function to start the continuous streaming process using FFmpeg
function startStreaming() {
  ffmpeg()
    .input(BACKGROUND_IMAGE) // Input the background image
    .loop() // Loop the image indefinitely
    .input(MP3_FILE) // Input the audio
    .inputOptions(['-stream_loop', '-1']) // Loop the audio indefinitely
    .complexFilter([
      {
        filter: 'drawtext',
        options: {
          textfile: OVERLAY_FILE,
          reload: 1,
          fontcolor: 'white', // Default color, will be overridden by [fg=color] in the text
          fontsize: 24,
          x: '(w-text_w)/2',
          y: '(h-text_h)/2',
          box: 1,
          boxcolor: 'black@0.5', // Semi-transparent box for better visibility
          boxborderw: 5,
          line_spacing: 10
        }
      }
    ])
    .outputOptions([
      '-c:v libx264',          // Video codec: H.264
      '-preset veryfast',      // Encoding preset for faster streaming
      '-b:v 6800k',            // Video bit rate: 6800 Kbps
      '-maxrate 6800k',        // Maximum bit rate
      '-bufsize 13600k',       // Buffer size (double the maxrate)
      '-pix_fmt yuv420p',      // Pixel format
      '-g 50',                 // Keyframe interval (typically twice the frame rate)
      '-c:a aac',              // Audio codec: AAC
      '-b:a 128k',             // Audio bit rate
      '-ar 44100',             // Audio sample rate
      '-f flv'                 // Streaming format: FLV
    ])
    .output(youtubeStreamUrl)
    .on('start', (commandLine) => {
      console.log(`FFmpeg streaming started with command: ${commandLine}`);
    })
    .on('error', (err, stdout, stderr) => {
      console.error('Error during streaming:', err.message);
      console.error('FFmpeg stderr:', stderr);
      // Attempt to restart the stream after a delay
      setTimeout(startStreaming, 5000);
    })
    .on('end', () => {
      console.log('FFmpeg streaming ended.');
      // Restart the stream after a delay
      setTimeout(startStreaming, 5000);
    })
    .run();
}

// Function to orchestrate periodic data fetching and overlay updating
async function updateOverlayPeriodically() {
  await fetchYouTubeData(); // Initial fetch
  // Schedule updates every minute
  setInterval(fetchYouTubeData, 60 * 1000);
}

// Initialize the streaming and overlay updates
async function initialize() {
  await updateOverlayPeriodically(); // Start updating the overlay
  startStreaming(); // Start streaming
}

initialize();

// Create a simple HTTP server to keep the app alive
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('The stream is live!\n');
}).listen(PORT, () => {
  console.log(`HTTP server running on port ${PORT}`);
});
