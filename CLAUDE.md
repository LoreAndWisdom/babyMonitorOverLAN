# Baby Monitor over LAN - Technical Documentation

## Project Overview

A cross-platform baby monitor application that runs on a local network. Mobile devices act as cameras, streaming video and audio to an admin panel running on the server machine.

**Key Features:**
- Real-time video streaming (10 FPS, JPEG frames)
- Real-time audio streaming (Opus codec, 128 kbps)
- Motion detection with configurable sensitivity
- Voice Activation (VOX) with configurable audio threshold
- Bandwidth optimization (only streams when activity detected)
- Dual HTTP/HTTPS support for mobile camera access
- Localhost-only admin panel for security

## Architecture

### Technology Stack
- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: Vanilla JavaScript, HTML5 Canvas, Web Audio API, MediaSource Extensions
- **Communication**: Socket.IO (WebSocket-based real-time bidirectional communication)
- **SSL**: Self-signed certificates with automatic generation and IP validation

### Server Components
- **Port 3000**: HTTP server (for non-HTTPS clients, admin redirect)
- **Port 3443**: HTTPS server (required for camera access on mobile devices)
- **Cross-server broadcasting**: HTTP and HTTPS Socket.IO instances communicate

### Client Types
1. **Camera Client** (`/` or `/index.html`):
   - Captures video via Canvas API
   - Captures audio via MediaRecorder
   - Detects motion by comparing frames
   - Detects voice using Web Audio API AnalyserNode
   - Streams to server only when activity detected

2. **Admin Panel** (`/admin` or `/admin/index.html`):
   - Displays all connected cameras
   - Shows real-time status (IDLE/VOX)
   - Plays audio via MediaSource Extensions
   - Configures VOX/motion detection thresholds
   - **Restricted to localhost only** for security

## File Structure

```
babyMonitorOverLAN/
├── server.js                  # Main server application
├── package.json               # NPM dependencies and scripts
├── setup-https.js             # SSL certificate generation script
├── certs/                     # SSL certificates (auto-generated)
│   ├── server.key
│   └── server.crt
├── public/                    # Camera client files
│   └── index.html             # Camera streaming page
└── admin/                     # Admin panel files
    └── index.html             # Admin dashboard
```

## How to Run

### First Time Setup
```bash
npm install
npm run generate-cert  # Or just run: node server.js (auto-generates)
```

### Start Server
```bash
npm start
# or
node server.js
```

### Access the Application

**Admin Panel (on server machine only):**
- HTTP: `http://localhost:3000/admin`
- HTTPS: `https://localhost:3443/admin`

**Camera Client (on mobile devices):**
- HTTPS (required): `https://<SERVER_IP>:3443`
- You must accept the self-signed certificate warning

**Finding Server IP:**
Server prints available IPs on startup:
```
HTTPS Server: https://192.168.1.100:3443
```

## Key Features Explained

### 1. Motion Detection

**How it works:**
- Captures video frame every 100ms
- Compares with previous frame pixel-by-pixel
- Counts pixels that changed significantly (RGB diff > 40)
- Calculates percentage of changed pixels
- Triggers if change exceeds sensitivity threshold

**Sensitivity Formula:**
```javascript
threshold = 20 - (videoSensitivity * 0.19)
// Sensitivity 1:   20% change required (low sensitivity)
// Sensitivity 15:  ~17% change required (default)
// Sensitivity 50:  5% change required
// Sensitivity 100: 0.5% change required (ultra sensitive)
```

**Optimizations:**
- Samples every 4th pixel for performance
- Pixel difference threshold of 40 to filter camera noise

### 2. Voice Activation (VOX)

**How it works:**
- Uses Web Audio API AnalyserNode on audio stream
- Calculates average frequency data (0-255 range)
- Normalizes to 0-100 scale
- Triggers if volume > audioThreshold

**Audio Threshold:**
- 1-100 scale (1 = very quiet, 100 = very loud)
- Default: 20
- Configurable from admin panel

### 3. Video Streaming

**Implementation:**
- Canvas captures video frame → converts to JPEG blob → base64 → Socket.IO
- Only sends frames when motion detected (bandwidth optimization)
- Quality: 0.7 JPEG compression
- Frame rate: 10 FPS (100ms interval)

**Admin Display:**
- Displays frames in `<img>` element
- Updates on each `video-data` Socket.IO event

### 4. Audio Streaming

**Client Side:**
- MediaRecorder captures audio in webm/opus format
- Chunk size: 500ms
- Bitrate: 128 kbps
- Always streams (not filtered by VOX)

**Admin Side (MediaSource Extensions):**
- Creates MediaSource with SourceBuffer
- Appends webm/opus chunks directly to buffer
- Browser handles decoding and playback
- Buffer management: keeps last 30 seconds, removes older data

**Why MSE instead of Audio element:**
- Audio element can't play fragmented webm chunks
- MSE designed for streaming media fragments
- Better cross-browser compatibility (Firefox, Chrome, Safari)

### 5. Status System

**States:**
- **IDLE**: No motion or sound detected
- **VOX**: Motion OR sound detected above threshold

**Update Logic:**
- Status checked every 200ms
- VOX triggered when `lastMotionDetected OR voiceDetected`
- 2-second hysteresis before returning to IDLE (prevents flickering)
- Status broadcast to all admin panels via Socket.IO

## Configuration

### VOX/Motion Detection Thresholds

Configured via admin panel UI (sliders):

```javascript
// Default values
{
  videoSensitivity: 15,  // 1-100, higher = more sensitive
  audioThreshold: 20     // 1-100, higher = louder sounds required
}
```

Changes are broadcast in real-time to all connected cameras.

### Server Ports

Can be configured via environment variables:

```bash
PORT=3000 HTTPS_PORT=3443 node server.js
```

## Security Considerations

### Admin Panel Protection

The admin panel is **restricted to localhost only** via middleware:

```javascript
function restrictToLocalhost(req, res, next) {
  const clientIP = req.ip || req.connection.remoteAddress;
  const normalizedIP = clientIP.replace(/^::ffff:/, '');
  const allowedIPs = ['127.0.0.1', '::1', 'localhost'];

  if (allowedIPs.some(ip => normalizedIP === ip || normalizedIP.startsWith(ip))) {
    next();
  } else {
    res.status(403).send(/* Access Denied page */);
  }
}
```

**To access admin panel remotely**, you must:
1. SSH tunnel: `ssh -L 3000:localhost:3000 user@server`
2. Or disable the restriction (not recommended)

### SSL Certificates

**Auto-generated on first run** or when IP changes:
- 2048-bit RSA key
- Valid for 365 days
- Includes all local network IPs in Subject Alternative Names
- Self-signed (browser warning expected)

**Certificate validation:**
Server checks certificate IPs on startup and regenerates if IPs changed.

## Data Flow

### Camera Client → Server → Admin Panel

1. **Camera connects:**
   - Socket.IO connection established
   - Sends `identify` event with `type: 'camera'`
   - Server stores client info and sends current thresholds

2. **Video streaming:**
   - Camera detects motion → captures frame → sends `video-stream` event
   - Server broadcasts `video-data` to all admins (HTTP + HTTPS)
   - Admin updates `<img>` element with new frame

3. **Audio streaming:**
   - MediaRecorder sends chunk every 500ms → `audio-stream` event
   - Server broadcasts `audio-data` to all admins
   - Admin appends to SourceBuffer → browser plays

4. **Status updates:**
   - Camera checks motion/voice every 200ms
   - Sends `camera-status` event when state changes
   - Server broadcasts to all admins
   - Admin updates status badge UI

5. **Threshold updates:**
   - Admin changes slider → sends `update-thresholds` event
   - Server stores new values
   - Server broadcasts `thresholds-update` to all cameras
   - Cameras update local threshold values

## Cross-Server Broadcasting

HTTP and HTTPS servers run separate Socket.IO instances but need to communicate:

```javascript
// Example: Broadcasting video data to both servers
socket.broadcast.emit('video-data', videoData); // This server's clients

if (io === httpIO && httpsIO) {
  httpsIO.emit('video-data', videoData); // Other server's clients
} else if (io === httpsIO && httpIO) {
  httpIO.emit('video-data', videoData);
}
```

This ensures admins on HTTP and HTTPS both receive all camera data.

## Troubleshooting

### Camera permission not prompted
**Cause:** Chrome/Safari require HTTPS for camera access
**Solution:** Use HTTPS URL (`https://<IP>:3443`) and accept certificate warning

### HTTPS connection refused
**Cause:** Certificate IP mismatch or firewall
**Solutions:**
- Check server logs for actual IP addresses
- Regenerate certificate: `rm -rf certs && node server.js`
- Check firewall: `sudo ufw allow 3443/tcp`

### Video streaming but status always IDLE
**Causes:**
1. Motion threshold too high (change < threshold)
2. Voice threshold too high (volume < threshold)
3. Status monitoring not started

**Debug:**
- Open browser console on camera client
- Look for logs: `Motion: X% change, threshold: Y%`
- Look for logs: `Voice: X% level, threshold: Y%`
- Look for logs: `Status: VOX` or `Status: IDLE`

### Audio not playing on admin panel
**Causes:**
1. Audio chunks not reaching server (check client console)
2. MediaSource/SourceBuffer errors (check admin console)
3. Browser autoplay policy blocking

**Debug:**
- Client console: Check for `Audio: sent X chunks`
- Admin console: Check for MediaSource errors
- Try clicking unmute button (requires user interaction)

### Admin page shows 403 Access Denied
**Cause:** Accessing from non-localhost IP
**Solution:** Access from server machine or use SSH tunnel

## Browser Compatibility

### Camera Client
- **Chrome/Edge**: ✅ Full support
- **Firefox**: ✅ Full support
- **Safari**: ✅ Full support (iOS requires HTTPS)

### Admin Panel
- **Chrome/Edge**: ✅ Full support (MSE, MediaSource)
- **Firefox**: ✅ Full support (MSE, MediaSource)
- **Safari**: ✅ Full support

## Performance Considerations

### Bandwidth Usage

**Without VOX/Motion Detection:**
- Video: ~500 KB/s per camera (10 FPS, JPEG 0.7)
- Audio: ~16 KB/s per camera (128 kbps)
- **Total:** ~516 KB/s per camera

**With VOX/Motion Detection:**
- Video: 0 KB/s when idle, ~500 KB/s when active
- Audio: ~16 KB/s (always streaming)
- **Average (assuming 20% activity):** ~116 KB/s per camera
- **Bandwidth savings:** ~77%

### CPU Usage

**Client (Camera):**
- Motion detection: Low (samples every 4th pixel)
- Voice detection: Low (Web Audio API AnalyserNode)
- Video encoding: Medium (Canvas toBlob JPEG)
- Audio encoding: Low (hardware accelerated)

**Server:**
- Very low (just relaying Socket.IO messages)
- Scales well with multiple cameras

**Admin:**
- Video decoding: Low (browser native JPEG)
- Audio decoding: Low (MSE hardware accelerated)

## Development Tips

### Testing Locally Without Mobile Device

1. Open two browser windows/tabs
2. Window 1: Camera client (`https://localhost:3443`)
3. Window 2: Admin panel (`http://localhost:3000/admin`)
4. Allow camera/microphone access on Window 1
5. You should see yourself in Window 2

### Debugging Socket.IO Events

Add this to any page to log all Socket.IO events:

```javascript
socket.onAny((eventName, ...args) => {
  console.log(`Socket.IO: ${eventName}`, args);
});
```

### Forcing Certificate Regeneration

```bash
rm -rf certs
node server.js
```

### Changing Default Thresholds

Edit `server.js`:

```javascript
const thresholds = {
  videoSensitivity: 15,  // Change this
  audioThreshold: 20     // Change this
};
```

## Future Enhancements (Ideas)

- [ ] Recording functionality (save video/audio to files)
- [ ] Motion detection zones (only detect in specific areas)
- [ ] Email/push notifications on VOX trigger
- [ ] Multiple admin users with different permissions
- [ ] Video history/playback
- [ ] Two-way audio (speak from admin to camera)
- [ ] Night vision mode (infrared support)
- [ ] Battery level indicator for mobile devices
- [ ] Configurable video quality/FPS
- [ ] Cloud backup integration

## Known Limitations

1. **Single camera per device**: One browser tab = one camera stream
2. **No video storage**: Streams are live-only, not recorded
3. **Local network only**: No internet/cloud functionality
4. **Self-signed SSL**: Browser warnings on first access
5. **Admin localhost-only**: Can't remotely manage without SSH tunnel
6. **No authentication**: Any device on LAN can connect as camera

## Technical Debt / TODOs

- [ ] Add unit tests for motion/voice detection
- [ ] Add authentication for camera clients
- [ ] Implement proper SSL with Let's Encrypt for production
- [ ] Add configuration file (JSON/YAML) instead of hardcoded values
- [ ] Implement connection recovery/reconnection logic
- [ ] Add video frame rate adaptation based on network conditions
- [ ] Optimize motion detection with Web Workers
- [ ] Add metrics/monitoring dashboard

## Contributing

When making changes:

1. **Test on actual mobile devices** - desktop browser simulation isn't perfect
2. **Test both HTTP and HTTPS** - ensure cross-server broadcasting works
3. **Check browser console** - look for errors on both client and admin
4. **Verify VOX system** - ensure thresholds are working correctly
5. **Test with multiple cameras** - ensure scaling works

## License

(Add your license information here)

## Credits

Built using:
- [Express.js](https://expressjs.com/)
- [Socket.IO](https://socket.io/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MediaSource Extensions](https://developer.mozilla.org/en-US/docs/Web/API/MediaSource)
