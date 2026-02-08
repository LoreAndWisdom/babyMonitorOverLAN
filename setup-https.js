#!/usr/bin/env node

const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('\n🔐 Setting up HTTPS for Baby Monitor...\n');

// Create certs directory
const certsDir = path.join(__dirname, 'certs');
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir);
  console.log('✓ Created certs directory');
}

// Get local IP addresses
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }

  return addresses;
}

const localIPs = getLocalIPs();
const primaryIP = localIPs[0] || '192.168.1.100';

console.log('Detected local IPs:', localIPs.join(', '));
console.log(`Using ${primaryIP} as primary IP\n`);

// Define certificate attributes
const attrs = [
  { name: 'commonName', value: primaryIP },
  { name: 'countryName', value: 'US' },
  { shortName: 'ST', value: 'State' },
  { name: 'localityName', value: 'City' },
  { name: 'organizationName', value: 'BabyMonitor' },
  { shortName: 'OU', value: 'Development' }
];

// Add Subject Alternative Names (SANs)
const altNames = [
  { type: 2, value: 'localhost' }, // DNS
  { type: 7, ip: '127.0.0.1' }, // IP
  ...localIPs.map(ip => ({ type: 7, ip: ip }))
];

const options = {
  keySize: 2048,
  days: 365,
  algorithm: 'sha256',
  extensions: [
    {
      name: 'subjectAltName',
      altNames: altNames
    }
  ]
};

try {
  console.log('⏳ Generating self-signed certificate...\n');

  const pems = selfsigned.generate(attrs, options);

  // Write private key
  const keyPath = path.join(certsDir, 'server.key');
  fs.writeFileSync(keyPath, pems.private, { mode: 0o600 });
  console.log('✓ Private key generated');

  // Write certificate
  const certPath = path.join(certsDir, 'server.crt');
  fs.writeFileSync(certPath, pems.cert);
  console.log('✓ Certificate generated');

  console.log('\n✅ HTTPS setup complete!\n');
  console.log('Certificate details:');
  console.log(`  - Valid for: 365 days`);
  console.log(`  - Primary IP: ${primaryIP}`);
  console.log(`  - All IPs: ${localIPs.join(', ')}`);
  console.log(`  - Includes: localhost, 127.0.0.1\n`);

  console.log('⚠️  IMPORTANT: Self-signed certificate warnings');
  console.log('When accessing from mobile devices, you will see a security warning.');
  console.log('This is normal for self-signed certificates.\n');

  console.log('To proceed on mobile:');
  console.log('  - Chrome (Android): Click "Advanced" → "Proceed to [IP] (unsafe)"');
  console.log('  - Safari (iOS): Tap "Show Details" → "visit this website"');
  console.log('  - Then reload the page\n');

  console.log('Now start the server with: npm start\n');

} catch (error) {
  console.error('\n❌ Failed to generate certificates:', error.message);
  console.error(error);
  process.exit(1);
}
