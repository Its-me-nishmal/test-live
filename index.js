const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Configuration Variables
const GOOGLE_SHEET_URL = 'https://script.googleusercontent.com/macros/echo?user_content_key=jrY6qgcIP0HclGr9W22qvj5h6WNkSG2yZRoIqKWQK9XMRTSBwYotjMZjavLa99F0QwDPZKvjjDZl9QU5FT0RP42aovy3fRUUm5_BxDlH2jW0nuo2oDemN9CCS2h10ox_1xSncGQajx_ryfhECjZEnC_lH6Xes5sj60JYhGEpjf2RIE1hP9cK6jI0Ln1fsVsK0LcP46IkpFL8F9V7EmWWl2Qm3wh0R6cbKFXj2yb-_wPsOF67hWI8cNz9Jw9Md8uu&lib=MJrc9AgLu8ITr5HB7zTL_mIm8UQkONTv'; // Your Google Apps Script URL
const MP3_FILE = path.join(__dirname, 'sample.mp3'); // Path to the MP3 audio file
const BACKGROUND_IMAGE = path.join(__dirname, 'bg.png'); // Path to the static black background image
const STREAM_KEY = 'r9mj-chv0-2cqh-wb1a-2jdq'; // Your YouTube stream key
const youtubeStreamUrl = `rtmp://a.rtmp.youtube.com/live2/${STREAM_KEY}`; // YouTube RTMP URL with stream key
const PLACEHOLDER_URL = 'https://placehold.co/600x400'; // Base URL for dynamic placeholder images
const PORT = process.env.PORT || 3000; // HTTP server port
let ffmpegStream = null; // To store the FFmpeg process

// Helper function to generate contrasting colors (dark background, light text)
function generateContrastingColors() {
  const darkColors = ['000000', '2c3e50', '34495e', '4A4947', '333333']; // Dark shades for background
  const lightColors = ['FFFFFF', 'ecf0f1', 'f1c40f', 'f39c12', 'D8D2C2']; // Light shades for text

  const randomBackground = darkColors[Math.floor(Math.random() * darkColors.length)];
  const randomText = lightColors[Math.floor(Math.random() * lightColors.length)];

  return { background: randomBackground, text: randomText };
}

// Function to fetch data from Google Sheets and generate a dynamic overlay image
async function fetchYouTubeData() {
  try {
    const response = await axios.get(GOOGLE_SHEET_URL);
    const data = response.data;

    // Generate contrasting colors
    const { background, text } = generateContrastingColors();

    // Prepare the dynamic placeholder URL with changing colors
    const dynamicPlaceholderUrl = `${PLACEHOLDER_URL}/${background}/png?&text${text}font=lora&text=Viewer%20Count:%20${data.viewerCount || 'N/A'}%20%0ALikes:%20${data.likes || 'N/A'}%20%0ASubscribers:%20${data.subscriberCount || 'N/A'}`;

    // Download the dynamic image as a new overlay image
    const overlayImagePath = path.join(__dirname, 'dynamic_overlay.png');
    const writer = fs.createWriteStream(overlayImagePath);
    const imageResponse = await axios({
      url: dynamicPlaceholderUrl,
      method: 'GET',
      responseType: 'stream'
    });

    imageResponse.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`Dynamic overlay generated with background color: ${background}, text color: ${text}`);
        resolve(overlayImagePath); // Return the path to the overlay image
      });
      writer.on('error', reject);
    });
  } catch (error) {
    console.error('Error fetching YouTube data or generating overlay:', error.message);
  }
}

// Function to start the continuous streaming process using FFmpeg
function startStreaming() {
  if (ffmpegStream) {
    console.log('Stopping existing FFmpeg stream.');
    ffmpegStream.kill('SIGTERM'); // Stop the existing stream
  }

  ffmpegStream = ffmpeg()
    .input(BACKGROUND_IMAGE) // Input the background image
    .loop()
    .input(MP3_FILE) // Input the looping audio file
    .inputOptions(['-stream_loop', '-1']) // Loop the audio indefinitely
    .input(path.join(__dirname, 'dynamic_overlay.png')) // Input the overlay image
    .complexFilter([
      {
        filter: 'overlay',
        options: {
          x: '(main_w-overlay_w)/2', // Center the overlay horizontally
          y: '(main_h-overlay_h)/2'  // Center the overlay vertically
        }
      }
    ])
    .outputOptions([
      '-c:v libx264',          // Video codec: H.264
      '-preset veryfast',      // Encoding preset for faster streaming
      '-maxrate 3000k',        // Max bitrate
      '-bufsize 6000k',        // Buffer size
      '-pix_fmt yuv420p',      // Pixel format
      '-g 50',                 // Keyframe interval
      '-c:a aac',              // Audio codec: AAC
      '-b:a 128k',             // Audio bitrate
      '-ar 44100',             // Audio sample rate
      '-f flv'                 // Streaming format: FLV
    ])
    .output(youtubeStreamUrl) // Output to YouTube
    .on('start', (commandLine) => {
      console.log(`FFmpeg streaming started with command: ${commandLine}`);
    })
    .on('error', (err) => {
      console.error('Error during streaming:', err.message);
      ffmpegStream = null;
      setTimeout(startStreaming, 5000); // Retry streaming after 5 seconds if an error occurs
    })
    .on('end', () => {
      console.log('FFmpeg streaming ended.');
      ffmpegStream = null;
      setTimeout(startStreaming, 5000); // Restart streaming after 5 seconds
    })
    .run();
}

// Function to periodically update the overlay and restart the stream
async function updateOverlayPeriodically() {
  try {
    const overlayPath = await fetchYouTubeData();
    console.log('Overlay updated. Restarting stream...');
    startStreaming(); // Restart the stream with the updated overlay
  } catch (error) {
    console.error('Failed to update overlay:', error.message);
  }
  // Schedule the next overlay update after 1 minute
  setTimeout(updateOverlayPeriodically, 60 * 1000);
}

// Start the streaming process
startStreaming();

// Start updating the overlay periodically every minute
updateOverlayPeriodically();

// Create a simple HTTP server to keep the app alive (useful for hosting services like Heroku)
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('The stream is live!\n');
}).listen(PORT, () => {
  console.log(`HTTP server running on port ${PORT}`);
});
