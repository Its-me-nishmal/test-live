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
const youtubeStreamUrl = `rtmp://a.rtmp.youtube.com/live2/${STREAM_KEY}`; // YouTube RTMP URL with stream key
const PORT = process.env.PORT || 3000; // HTTP server port
const VIDEO_DURATION = 30; // Duration of each video in seconds (30 or 60)
let currentVideoPath = ''; // To store the path of the currently generated video

// Function to fetch data from Google Sheets and update the overlay text file
async function fetchYouTubeData() {
  try {
    const response = await axios.get(GOOGLE_SHEET_URL);
    const data = response.data;

    // Prepare the overlay text
    const overlayText = `
Viewer Count: ${data.viewerCount || 'N/A'}
Likes: ${data.likes || 'N/A'}
Subscriber Count: ${data.subscriberCount || 'N/A'}
    `.trim();

    // Write the overlay text to the file
    fs.writeFileSync(OVERLAY_FILE, overlayText, 'utf8');
    console.log(`Overlay updated: ${overlayText}`);
  } catch (error) {
    console.error('Error fetching YouTube data:', error.message);
  }
}

// Function to delete the old video file
function deleteOldVideo() {
  if (currentVideoPath && fs.existsSync(currentVideoPath)) {
    fs.unlink(currentVideoPath, (err) => {
      if (err) {
        console.error(`Failed to delete old video (${currentVideoPath}):`, err.message);
      } else {
        console.log(`Deleted old video: ${currentVideoPath}`);
      }
    });
  }
}

// Function to create a new video with the overlay
function createNewVideo() {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const newVideoPath = path.join(__dirname, `video_${timestamp}.mp4`);

    ffmpeg()
      .input(BACKGROUND_IMAGE)
      .loop(VIDEO_DURATION) // Loop the background image for VIDEO_DURATION seconds
      .input(MP3_FILE)
      .inputOptions(['-stream_loop', '-1']) // Loop the audio indefinitely (will be cut by duration)
      .complexFilter([
        // Overlay text data (reload the overlay file every second)
        {
          filter: 'drawtext',
          options: {
            textfile: OVERLAY_FILE,
            reload: 1,
            fontcolor: 'white',
            fontsize: 24,
            x: '(w-text_w)/2',
            y: '(h-text_h)/2'
          }
        }
      ])
      .outputOptions([
        '-c:v libx264',          // Video codec: H.264
        '-preset veryfast',      // Encoding preset
        '-maxrate 3000k',        // Max bitrate
        '-bufsize 6000k',        // Buffer size
        '-pix_fmt yuv420p',      // Pixel format
        '-g 50',                 // Keyframe interval
        '-c:a aac',              // Audio codec: AAC
        '-b:a 128k',             // Audio bitrate
        '-ar 44100',             // Audio sample rate
        `-t ${VIDEO_DURATION}`   // Duration of the video
      ])
      .save(newVideoPath)
      .on('start', (commandLine) => {
        console.log(`FFmpeg process started for video creation with command: ${commandLine}`);
      })
      .on('end', () => {
        console.log(`Video created: ${newVideoPath}`);
        currentVideoPath = newVideoPath;
        resolve(newVideoPath);
      })
      .on('error', (err) => {
        console.error('Error occurred during video creation:', err.message);
        reject(err);
      });
  });
}

// Function to stream a video file to YouTube
function streamVideoToYouTube(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .inputOptions(['-re']) // Read input in real-time
      .outputOptions([
        '-c:v libx264',          // Video codec: H.264
        '-preset veryfast',      // Encoding preset
        '-maxrate 3000k',        // Max bitrate
        '-bufsize 6000k',        // Buffer size
        '-pix_fmt yuv420p',      // Pixel format
        '-g 50',                 // Keyframe interval
        '-c:a aac',              // Audio codec: AAC
        '-b:a 128k',             // Audio bitrate
        '-ar 44100',             // Audio sample rate
        '-f flv'                 // Streaming format: FLV
      ])
      .output(youtubeStreamUrl)
      .on('start', (commandLine) => {
        console.log(`FFmpeg streaming started with command: ${commandLine}`);
      })
      .on('end', () => {
        console.log('FFmpeg streaming finished.');
        resolve();
      })
      .on('error', (err) => {
        console.error('Error occurred during streaming:', err.message);
        reject(err);
      })
      .run();
  });
}

// Function to orchestrate fetching data, creating video, streaming, and cleaning up
async function processStreamCycle() {
  try {
    await fetchYouTubeData();
    const videoPath = await createNewVideo();
    await streamVideoToYouTube(videoPath);
    deleteOldVideo();
  } catch (error) {
    console.error('Error during stream cycle:', error.message);
  } finally {
    // Schedule the next cycle after VIDEO_DURATION seconds
    setTimeout(processStreamCycle, VIDEO_DURATION * 1000);
  }
}

// Start the streaming cycle
processStreamCycle();

// Create a simple HTTP server to keep the app alive (useful for hosting services like Heroku)
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('The stream is live!\n');
}).listen(PORT, () => {
  console.log(`HTTP server running on port ${PORT}`);
});
