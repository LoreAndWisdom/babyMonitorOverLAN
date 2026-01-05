const express = require('express');
const http = require('http');
const https = require('https');
const socketIO = require('socket.io');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');

const app = express();

const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// Store connected clients
const clients = new Map();

// Store Socket.IO instances for cross-server broadcasting
let httpIO, httpsIO;

// Middleware to restrict admin access to localhost only
function restrictToLocalhost(req, res, next) {
  const clientIP = req.ip || req.connection.remoteAddress;
  const normalizedIP = clientIP.replace(/^::ffff:/, ''); // Remove IPv6 prefix if present

  // Allow localhost in various forms
  const allowedIPs = ['127.0.0.1', '::1', 'localhost'];
  const isLocalhost = allowedIPs.some(ip => normalizedIP === ip || normalizedIP.startsWith(ip));

  if (isLocalhost) {
    next();
  } else {
    console.log(`⚠️  Blocked admin access attempt from: ${clientIP}`);
    res.status(403).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Access Denied</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .container {
            text-align: center;
            padding: 40px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            max-width: 600px;
          }
          h1 { font-size: 48px; margin-bottom: 20px; }
          p { font-size: 18px; line-height: 1.6; }
          .icon { font-size: 80px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">🔒</div>
          <h1>Access Denied</h1>
          <p>The admin panel can only be accessed from the server machine (localhost).</p>
          <p>Your IP: ${clientIP}</p>
          <p><strong>To access the admin panel:</strong><br>
          Open your browser on the server machine and visit:<br>
          http://localhost:${PORT}/admin or https://localhost:${HTTPS_PORT}/admin</p>
        </div>
      </body>
      </html>
    `);
  }
}

// Serve static files
app.use(express.static('public'));
app.use('/admin', restrictToLocalhost, express.static('admin'));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', restrictToLocalhost, (req, res) => {
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

// Check if certificate includes all current IPs
function checkCertificateIPs() {
  const certPath = path.join(__dirname, 'certs', 'server.crt');

  if (!fs.existsSync(certPath)) {
    return false;
  }

  try {
    const currentIPs = getLocalIPs();

    // Get IPs from certificate
    const certOutput = execSync(
      `openssl x509 -in "${certPath}" -text -noout | grep "IP Address"`,
      { encoding: 'utf8' }
    );

    // Extract IP addresses from certificate
    const certIPs = [];
    const ipMatches = certOutput.match(/IP Address:(\d+\.\d+\.\d+\.\d+)/g);
    if (ipMatches) {
      ipMatches.forEach(match => {
        const ip = match.replace('IP Address:', '');
        if (ip !== '127.0.0.1') {
          certIPs.push(ip);
        }
      });
    }

    // Check if all current IPs are in the certificate
    for (const ip of currentIPs) {
      if (!certIPs.includes(ip)) {
        console.log(`⚠️  Certificate missing IP: ${ip}`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error checking certificate:', error.message);
    return false;
  }
}

// Generate SSL certificates
function generateCertificates() {
  console.log('\n🔐 Generating SSL certificates...');

  try {
    execSync('node setup-https.js', {
      stdio: 'inherit',
      cwd: __dirname
    });
    console.log('✅ Certificates generated successfully\n');
    return true;
  } catch (error) {
    console.error('❌ Failed to generate certificates:', error.message);
    return false;
  }
}

// Ensure certificates exist and are valid
function ensureCertificates() {
  const certPath = path.join(__dirname, 'certs', 'server.crt');
  const keyPath = path.join(__dirname, 'certs', 'server.key');

  // Check if certificates exist
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.log('📋 Certificates not found');
    return generateCertificates();
  }

  // Check if current IPs are in the certificate
  if (!checkCertificateIPs()) {
    console.log('📋 Certificate IPs outdated, regenerating...');
    return generateCertificates();
  }

  console.log('✅ Valid certificates found');
  return true;
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
        const clientData = clients.get(clientId);
        io.emit('camera-connected', clientData);

        // Also notify admins on the other server
        if (io === httpIO && httpsIO) {
          httpsIO.emit('camera-connected', clientData);
        } else if (io === httpsIO && httpIO) {
          httpIO.emit('camera-connected', clientData);
        }
      }
    });

    // Handle video stream from camera clients
    socket.on('video-stream', (data) => {
      // Broadcast video data to all admin clients on both HTTP and HTTPS servers
      const videoData = {
        clientId: clientId,
        data: data
      };

      // Broadcast to this server's clients
      socket.broadcast.emit('video-data', videoData);

      // Also broadcast to the other server's clients (HTTP or HTTPS)
      if (io === httpIO && httpsIO) {
        httpsIO.emit('video-data', videoData);
      } else if (io === httpsIO && httpIO) {
        httpIO.emit('video-data', videoData);
      }
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
        // Notify admins on both servers that camera disconnected
        io.emit('camera-disconnected', clientId);

        if (io === httpIO && httpsIO) {
          httpsIO.emit('camera-disconnected', clientId);
        } else if (io === httpsIO && httpIO) {
          httpIO.emit('camera-disconnected', clientId);
        }
      }

      clients.delete(clientId);
    });
  });
}

// Create HTTP server
const httpServer = http.createServer(app);
httpIO = socketIO(httpServer, {
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

  console.log('\nAdmin panel (localhost only - for security):');
  console.log(`  http://localhost:${PORT}/admin`);
  console.log(`  https://localhost:${HTTPS_PORT}/admin`);
  console.log('\n💡 Note: Admin panel is restricted to localhost for security.');
  console.log('   Open your browser on this server machine to access it.');
});

// Ensure certificates are generated and valid
if (ensureCertificates()) {
  // Start HTTPS server
  try {
    const certPath = path.join(__dirname, 'certs', 'server.crt');
    const keyPath = path.join(__dirname, 'certs', 'server.key');

    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };

    const httpsServer = https.createServer(httpsOptions, app);
    httpsIO = socketIO(httpsServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      maxHttpBufferSize: 1e8
    });

    setupSocketHandlers(httpsIO);

    httpsServer.listen(HTTPS_PORT, () => {
      console.log(`\n✅ HTTPS Server started on port ${HTTPS_PORT}`);
      console.log('Mobile camera access enabled!');
      console.log('\nNote: You will need to accept the security warning in your browser.');
      console.log('=================================\n');
    });
  } catch (error) {
    console.error('\n❌ Failed to start HTTPS server:', error.message);
    console.log('\nThere was an error starting the HTTPS server.');
    console.log('Please check the error message above.\n');
    console.log('=================================\n');
  }
} else {
  console.log('\n❌ Failed to generate certificates');
  console.log('HTTPS server will not be available.');
  console.log('Mobile camera access will not work.\n');
  console.log('=================================\n');
}
