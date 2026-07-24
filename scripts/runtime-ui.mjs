import http from 'node:http';
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.FRONTEND_PORT);
const apiPort = Number(process.env.BACKEND_PORT);
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>LegalForms Governed Runtime</title><style>body{font:16px system-ui;background:#eef2f7;color:#172033;margin:0}main{max-width:760px;margin:10vh auto;background:white;padding:3rem;border-radius:18px;box-shadow:0 18px 60px #1222}h1{color:#173b67}.tag{display:inline-block;background:#dcecff;padding:.4rem .8rem;border-radius:999px}</style></head><body><main><span class="tag">Governed runtime</span><h1>LegalForms</h1><p>Authenticated legal-document readiness and provider evidence are available through the protected API.</p></main></body></html>`;
const server = http.createServer((req, res) => {
  if (req.url?.startsWith('/api/') || req.url === '/healthz' || req.url === '/readyz') {
    const proxy = http.request({ hostname: host, port: apiPort, path: req.url, method: req.method, headers: req.headers }, (upstream) => { res.writeHead(upstream.statusCode || 502, upstream.headers); upstream.pipe(res); });
    proxy.on('error', () => { res.writeHead(502); res.end('API unavailable'); }); req.pipe(proxy); return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(page);
});
server.listen(port, host, () => console.log(`LegalForms UI listening on http://${host}:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
