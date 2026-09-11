import 'dotenv/config';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  // CORS 허용
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // API route: /api/calculate
  if (req.url === '/api/calculate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body);
        const { default: handler } = await import('./api/calculate.js');
        const mockReq = {
          method: 'POST',
          body: parsed,
          headers: req.headers
        };
        const mockRes = {
          statusCode: 200,
          headers: {},
          setHeader(name, value) { this.headers[name] = value; },
          status(code) { this.statusCode = code; return this; },
          json(data) {
            res.statusCode = this.statusCode;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return this;
          },
          end() { res.end(); }
        };
        await handler(mockReq, mockRes);
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // 정적 파일 서빙: / → index.html
  if (req.url === '/' || req.url === '/index.html') {
    res.setHeader('Content-Type', 'text/html');
    res.end(await readFile(join(__dirname, 'index.html')));
    return;
  }

  // 404
  res.statusCode = 404;
  res.end('Not Found');
});

async function readFile(path) {
  const fs = await import('node:fs');
  return fs.promises.readFile(path);
}

server.listen(PORT, () => {
  console.log(`DDC 로컬 서버: http://localhost:${PORT}`);
});
