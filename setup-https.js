#!/usr/bin/env node

const { execSync } = require('child_process');
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

// Check if openssl is available
try {
  execSync('openssl version', { stdio: 'ignore' });
} catch (error) {
  console.error('❌ OpenSSL is not installed!');
  console.log('\nPlease install OpenSSL:');
  console.log('  - Windows: Download from https://slproweb.com/products/Win32OpenSSL.html');
  console.log('  - macOS: brew install openssl');
  console.log('  - Linux: sudo apt-get install openssl (Debian/Ubuntu)');
  console.log('           sudo yum install openssl (RHEL/CentOS)');
  process.exit(1);
}

// Create OpenSSL config file with Subject Alternative Names
const configContent = `
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=US
ST=State
L=City
O=BabyMonitor
OU=Development
CN=${primaryIP}

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
IP.2 = ${primaryIP}
${localIPs.map((ip, i) => `IP.${i + 3} = ${ip}`).join('\n')}
`;

const configPath = path.join(certsDir, 'openssl.cnf');
fs.writeFileSync(configPath, configContent);
console.log('✓ Created OpenSSL configuration');

// Generate private key
const keyPath = path.join(certsDir, 'server.key');
const certPath = path.join(certsDir, 'server.crt');

try {
  console.log('\n⏳ Generating private key...');
  execSync(`openssl genrsa -out "${keyPath}" 2048`, { stdio: 'inherit' });
  console.log('✓ Private key generated');

  console.log('\n⏳ Generating self-signed certificate...');
  execSync(
    `openssl req -new -x509 -key "${keyPath}" -out "${certPath}" -days 365 -config "${configPath}" -extensions v3_req`,
    { stdio: 'inherit' }
  );
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
  process.exit(1);
}
