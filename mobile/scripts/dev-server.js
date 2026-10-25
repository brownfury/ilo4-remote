// Local Dev Server & CORS/SSL Proxy for Browser Testing
// Allows testing the mobile app in desktop browsers without CORS or self-signed cert blocks.
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const WWW_DIR = path.join(__dirname, '..', 'www');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // 1. CORS headers for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);

  // 2. Dev HTTP Proxy for bypassing browser CORS & self-signed cert blocks
  if (parsedUrl.pathname === '/__proxy') {
    const targetUrl = parsedUrl.query.url;
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing target url parameter' }));
      return;
    }

    let bodyChunks = [];
    req.on('data', chunk => bodyChunks.push(chunk));
    req.on('end', () => {
      const bodyData = Buffer.concat(bodyChunks);
      const parsedTarget = url.parse(targetUrl);
      const isHttps = parsedTarget.protocol === 'https:';
      const transport = isHttps ? https : http;

      const proxyHeaders = { ...req.headers };
      delete proxyHeaders['host'];
      delete proxyHeaders['origin'];
      delete proxyHeaders['referer'];
      proxyHeaders['Host'] = parsedTarget.host;

      const proxyOpts = {
        hostname: parsedTarget.hostname,
        port: parsedTarget.port || (isHttps ? 443 : 80),
        path: parsedTarget.path,
        method: req.method,
        headers: proxyHeaders,
        rejectUnauthorized: false // Ignore self-signed certificates in dev mode
      };

      const proxyReq = transport.request(proxyOpts, (proxyRes) => {
        const resHeaders = { ...proxyRes.headers };
        resHeaders['Access-Control-Allow-Origin'] = '*';
        resHeaders['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
        resHeaders['Access-Control-Allow-Headers'] = '*';

        res.writeHead(proxyRes.statusCode, resHeaders);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Proxy Error: ${err.message}` }));
      });

      if (bodyData.length > 0) {
        proxyReq.write(bodyData);
      }
      proxyReq.end();
    });
    return;
  }

  // 3. Static Web Files Server
  let reqPath = parsedUrl.pathname;
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(WWW_DIR, reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 iLO 4 & Proxmox Remote Dev Server running at:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   http://127.0.0.1:${PORT}\n`);
  console.log(`Bypasses browser CORS & self-signed SSL restrictions via /__proxy`);
});
