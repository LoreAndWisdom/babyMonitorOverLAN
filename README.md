# Baby Monitor Over LAN

A cross-platform baby monitor application that allows you to stream camera feeds from mobile devices to a central server over your local network. Perfect for turning spare smartphones into wireless baby monitors!

## Features

- 📱 **Mobile Camera Client** - Access camera from any smartphone browser
- 🖥️ **Admin Dashboard** - View all connected cameras in real-time
- 🌐 **Cross-Platform** - Works on Windows, macOS, and Linux
- 🔒 **Local Network Only** - All data stays on your LAN for privacy
- 📹 **Multiple Cameras** - Support for multiple camera devices simultaneously
- 🔄 **Auto-Reconnect** - Handles connection drops gracefully
- 📊 **Device Tracking** - Shows IP addresses and connection status

## Prerequisites

- [Node.js](https://nodejs.org/) (version 14 or higher)
- A local network (Wi-Fi or Ethernet)
- Mobile devices with camera and web browser

## Installation

1. Clone this repository or download the source code:
```bash
git clone <repository-url>
cd babyMonitorOverLAN
```

2. Install dependencies:
```bash
npm install
```

## Usage

### Starting the Server

1. Start the server:
```bash
npm start
```

2. The server will display the URLs to access:
```
=================================
Baby Monitor LAN Server Running
=================================

Server started on port 3000

Access the camera client from mobile devices at:
  http://192.168.1.100:3000

Access the admin panel at:
  http://192.168.1.100:3000/admin

=================================
```

### Setting Up Mobile Camera

1. On your mobile device, open a web browser
2. Navigate to the camera client URL (e.g., `http://192.168.1.100:3000`)
3. Click "Start Camera"
4. Grant camera permissions when prompted
5. The device will start streaming to the server

**Camera Controls:**
- **Start Camera** - Begin streaming video
- **Stop Camera** - Stop streaming
- **Switch Camera** - Toggle between front and rear cameras

### Viewing Feeds (Admin Panel)

1. On your computer or any device, open a web browser
2. Navigate to the admin panel URL (e.g., `http://192.168.1.100:3000/admin`)
3. You'll see all connected cameras with their:
   - IP addresses
   - Live video feeds
   - Connection status
   - Connection time

**Admin Features:**
- View multiple camera feeds simultaneously
- Click "Fullscreen" on any feed for full-screen viewing
- Auto-updates when cameras connect/disconnect
- Click "Refresh" to manually update the device list

## Network Configuration

### Finding Your Server IP

The server automatically detects and displays your local IP addresses. If you need to find it manually:

**Windows:**
```cmd
ipconfig
```
Look for "IPv4 Address" under your active network adapter.

**macOS/Linux:**
```bash
ifconfig
# or
ip addr show
```
Look for an address starting with `192.168.x.x` or `10.x.x.x`.

### Port Configuration

By default, the server runs on port 3000. To use a different port:

```bash
PORT=8080 npm start
```

### Firewall Configuration

Ensure your firewall allows incoming connections on the server port (default: 3000):

**Windows:**
- Open Windows Defender Firewall
- Click "Advanced Settings"
- Create a new Inbound Rule for port 3000

**macOS:**
```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add node
```

**Linux (UFW):**
```bash
sudo ufw allow 3000
```

## Architecture

### Technology Stack

- **Backend:** Node.js + Express
- **Real-time Communication:** Socket.IO
- **Video Streaming:** WebRTC MediaRecorder API
- **Frontend:** Vanilla JavaScript (no frameworks required)

### How It Works

1. Mobile devices connect to the server and request camera access
2. Video is captured using the browser's `getUserMedia` API
3. Video is encoded using `MediaRecorder` and sent via WebSocket
4. Admin panel receives video chunks and displays them in real-time
5. All communication happens over Socket.IO for reliability

### Project Structure

```
babyMonitorOverLAN/
├── server.js           # Main server application
├── package.json        # Node.js dependencies
├── public/             # Mobile camera client
│   └── index.html      # Camera streaming page
├── admin/              # Admin dashboard
│   └── index.html      # Feed viewing page
└── README.md          # This file
```

## Troubleshooting

### Camera Not Working on Mobile

- Ensure you're using HTTPS or localhost (required for camera access)
- Check browser permissions for camera access
- Try a different browser (Chrome/Safari recommended)
- Make sure no other app is using the camera

### Cannot Connect to Server

- Verify the mobile device is on the same network as the server
- Check that the server is running (`npm start`)
- Ensure firewall isn't blocking the port
- Try accessing from the server device first

### Video Not Appearing in Admin Panel

- Check browser console for errors (F12)
- Ensure camera client shows "Streaming..." status
- Try refreshing both pages
- Check network connectivity

### Poor Video Quality

- Reduce the number of connected devices
- Check your network bandwidth
- Adjust video quality in `public/index.html` (line 192):
```javascript
videoBitsPerSecond: 500000 // Adjust this value
```

## Security Considerations

- This application is designed for **LOCAL NETWORK USE ONLY**
- Do not expose to the internet without proper security measures
- All video data is transmitted unencrypted over your LAN
- For internet access, use a VPN or implement HTTPS with authentication

## Browser Compatibility

### Mobile Devices
- ✅ Chrome (Android)
- ✅ Safari (iOS)
- ✅ Firefox (Android)
- ✅ Edge (Android)

### Desktop/Admin Panel
- ✅ Chrome
- ✅ Firefox
- ✅ Edge
- ✅ Safari

## License

CC0 1.0 Universal - See LICENSE file for details

## Contributing

Contributions are welcome! Feel free to submit issues and pull requests.

## Roadmap

Potential future enhancements:
- [ ] Audio support
- [ ] Motion detection
- [ ] Recording capabilities
- [ ] Mobile admin app
- [ ] Two-way communication
- [ ] Night mode
- [ ] Multiple admin views
- [ ] HTTPS support
- [ ] Authentication system

## Support

For issues, questions, or suggestions, please open an issue on the repository.

---

Made with ❤️ for parents everywhere
