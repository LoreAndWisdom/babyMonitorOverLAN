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

**That's it!** The server will automatically generate SSL certificates on first run.

### Manual Certificate Generation (Optional)

If you want to generate certificates before starting the server:
```bash
npm run generate-cert
```

Or use the complete setup:
```bash
npm run setup  # Installs dependencies and generates certificates
```

**Note:** You need OpenSSL installed on your system. Most Linux/macOS systems have it pre-installed. For Windows, download from [slproweb.com](https://slproweb.com/products/Win32OpenSSL.html).

### Automatic Certificate Management

The server automatically manages SSL certificates:
- ✅ **First run:** Generates certificates automatically
- ✅ **IP changes:** Detects when your IP address changes and regenerates certificates
- ✅ **No manual intervention:** Just run `npm start` and everything works

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

HTTP Server started on port 3000

⚠️  WARNING: Camera access requires HTTPS on mobile browsers!

For mobile devices, use HTTPS:
  https://192.168.1.100:3443

✅ HTTPS Server started on port 3443
Self-signed certificate found - mobile camera access enabled!

Note: You will need to accept the security warning in your browser.
=================================
```

**Important:** Mobile devices must use the HTTPS URL (port 3443) to access the camera!

### Setting Up Mobile Camera

1. On your mobile device, open a web browser (Chrome or Safari recommended)
2. Navigate to the **HTTPS** camera client URL (e.g., `https://192.168.1.100:3443`)
3. **Accept the security warning** (this is normal for self-signed certificates):
   - **Chrome (Android):** Tap "Advanced" → "Proceed to [IP] (unsafe)"
   - **Safari (iOS):** Tap "Show Details" → "visit this website"
   - **Firefox (Android):** Tap "Advanced" → "Accept the Risk and Continue"
4. Click "Start Camera"
5. Grant camera permissions when prompted
6. The device will start streaming to the server

**Troubleshooting:** If you see "HTTPS Required" warning:
- Make sure you're using `https://` (not `http://`)
- Use port 3443 (not 3000)
- Accept the certificate warning first

**Camera Controls:**
- **Start Camera** - Begin streaming video
- **Stop Camera** - Stop streaming
- **Switch Camera** - Toggle between front and rear cameras

### Viewing Feeds (Admin Panel)

**Important:** For security, the admin panel is only accessible from the server machine (localhost).

1. **On the server machine**, open a web browser
2. Navigate to the admin panel:
   - **HTTP:** `http://localhost:3000/admin`
   - **HTTPS:** `https://localhost:3443/admin`
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

**Security Note:** The admin panel cannot be accessed from other devices on the network. This prevents unauthorized viewing of camera feeds. If you try to access from another device, you'll see an "Access Denied" message.

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

### "HTTPS Required" Error on Mobile

**This is the most common issue!** Mobile browsers require HTTPS for camera access.

**Solution:**
1. Use `https://` instead of `http://`
2. Use port 3443 instead of 3000
3. Accept the security warning in your browser
4. Example: `https://192.168.1.100:3443` (not `http://192.168.1.100:3000`)

### Certificate Issues

The server automatically handles certificates, but if you encounter issues:

**Manual regeneration:**
```bash
npm run generate-cert
```

The server will also automatically regenerate certificates if:
- They don't exist
- Your IP address has changed
- They're missing current IP addresses

### Camera Not Working on Mobile

- ✅ Verify you're using **HTTPS** (https:// not http://)
- ✅ Accept the certificate security warning
- ✅ Check browser permissions for camera access
- ✅ Try a different browser (Chrome/Safari recommended)
- ✅ Make sure no other app is using the camera
- ✅ Reload the page after accepting the certificate warning

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
- **Admin panel is restricted to localhost only** - can only be accessed from the server machine
- Camera feeds can be accessed from any device on the LAN, but viewing requires admin access
- Self-signed certificates are used for HTTPS (you'll see browser warnings - this is normal)
- Video data is transmitted over your local network only
- Do not expose to the internet without proper security measures:
  - Use a VPN for remote access
  - Implement proper authentication
  - Use valid SSL certificates
  - Add rate limiting and connection monitoring
- The self-signed certificate is generated locally and includes your local IP addresses

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
- [ ] Authentication system
- [ ] Bandwidth optimization
- [ ] Multi-camera split view

## Support

For issues, questions, or suggestions, please open an issue on the repository.

---

Made with ❤️ for parents everywhere
