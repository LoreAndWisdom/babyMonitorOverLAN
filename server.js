const express = require('express');
const http = require('http');
const https = require('https');
const socketIO = require('socket.io');
const path = require('path');
const os = require('os');
const fs = require('fs');

const app = express();

const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// Store connected clients
const clients = new Map();

// Serve static files
app.use(express.static('public'));
app.use('/admin', express.static('admin'));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Get server's local IP addresses
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }

  return addresses;
}

// Socket.IO connection handling
function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    const clientIP = socket.handshake.address;
    const clientId = socket.id;

    console.log(`Client connected: ${clientId} from ${clientIP}`);

    // Handle client identification
    socket.on('identify', (data) => {
      const clientType = data.type; // 'camera' or 'admin'

      clients.set(clientId, {
        id: clientId,
        ip: clientIP,
        type: clientType,
        connected: true,
        connectedAt: new Date().toISOString()
      });

      console.log(`Client ${clientId} identified as ${clientType}`);

      // If admin connects, send list of all camera clients
      if (clientType === 'admin') {
        const cameraClients = Array.from(clients.values()).filter(c => c.type === 'camera');
        socket.emit('clients-list', cameraClients);
      }

      // Notify all admins about the new camera
      if (clientType === 'camera') {
        io.emit('camera-connected', clients.get(clientId));
      }
    });

    // Handle video stream from camera clients
    socket.on('video-stream', (data) => {
      // Broadcast video data to all admin clients
      socket.broadcast.emit('video-data', {
        clientId: clientId,
        data: data
      });
    });

    // Handle request for clients list
    socket.on('request-clients-list', () => {
      const cameraClients = Array.from(clients.values()).filter(c => c.type === 'camera');
      socket.emit('clients-list', cameraClients);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${clientId}`);

      const client = clients.get(clientId);
      if (client && client.type === 'camera') {
        // Notify admins that camera disconnected
        io.emit('camera-disconnected', clientId);
      }

      clients.delete(clientId);
    });
  });
}

// Create HTTP server
const httpServer = http.createServer(app);
const httpIO = socketIO(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 1e8 // 100 MB for video chunks
});

setupSocketHandlers(httpIO);

// Start HTTP server
httpServer.listen(PORT, () => {
  console.log('\n=================================');
  console.log('Baby Monitor LAN Server Running');
  console.log('=================================');
  console.log(`\nHTTP Server started on port ${PORT}`);

  const localIPs = getLocalIPs();

  console.log('\n⚠️  WARNING: Camera access requires HTTPS on mobile browsers!');
  console.log('\nFor mobile devices, use HTTPS:');
  if (localIPs.length > 0) {
    localIPs.forEach(ip => {
      console.log(`  https://${ip}:${HTTPS_PORT}`);
    });
  }

  console.log('\nFor testing on the same device (HTTP works):');
  console.log(`  http://localhost:${PORT}`);

  console.log('\nAdmin panel (works on HTTP):');
  if (localIPs.length > 0) {
    localIPs.forEach(ip => {
      console.log(`  http://${ip}:${PORT}/admin`);
      console.log(`  https://${ip}:${HTTPS_PORT}/admin`);
    });
  }
});

// Try to start HTTPS server if certificates exist
const certPath = path.join(__dirname, 'certs', 'server.crt');
const keyPath = path.join(__dirname, 'certs', 'server.key');

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  try {
    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };

    const httpsServer = https.createServer(httpsOptions, app);
    const httpsIO = socketIO(httpsServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      maxHttpBufferSize: 1e8
    });

    setupSocketHandlers(httpsIO);

    httpsServer.listen(HTTPS_PORT, () => {
      console.log(`\n✅ HTTPS Server started on port ${HTTPS_PORT}`);
      console.log('Self-signed certificate found - mobile camera access enabled!');
      console.log('\nNote: You will need to accept the security warning in your browser.');
      console.log('=================================\n');
    });
  } catch (error) {
    console.error('\n❌ Failed to start HTTPS server:', error.message);
    console.log('\nRun: npm run generate-cert');
    console.log('Then restart the server.\n');
    console.log('=================================\n');
  }
} else {
  console.log('\n⚠️  HTTPS certificates not found!');
  console.log('\nTo enable camera access on mobile devices:');
  console.log('1. Run: npm run generate-cert');
  console.log('2. Restart the server');
  console.log('\nOr use the setup script:');
  console.log('   node setup-https.js');
  console.log('\n=================================\n');
}
