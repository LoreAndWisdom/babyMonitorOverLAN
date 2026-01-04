const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 1e8 // 100 MB for video chunks
});

const PORT = process.env.PORT || 3000;

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

// Start server
server.listen(PORT, () => {
  console.log('\n=================================');
  console.log('Baby Monitor LAN Server Running');
  console.log('=================================');
  console.log(`\nServer started on port ${PORT}`);
  console.log('\nAccess the camera client from mobile devices at:');

  const localIPs = getLocalIPs();
  if (localIPs.length > 0) {
    localIPs.forEach(ip => {
      console.log(`  http://${ip}:${PORT}`);
    });
  } else {
    console.log(`  http://localhost:${PORT}`);
  }

  console.log('\nAccess the admin panel at:');
  if (localIPs.length > 0) {
    localIPs.forEach(ip => {
      console.log(`  http://${ip}:${PORT}/admin`);
    });
  } else {
    console.log(`  http://localhost:${PORT}/admin`);
  }
  console.log('\n=================================\n');
});
