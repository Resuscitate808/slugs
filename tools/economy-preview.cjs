const http = require('node:http');
const server = http.createServer((req, res) => {
    const upstream = http.request({ hostname: '127.0.0.1', port: 7456, path: req.url, method: req.method, headers: { ...req.headers, host: '127.0.0.1:7456' } }, reply => {
        res.writeHead(reply.statusCode, reply.headers); reply.pipe(res);
    });
    upstream.on('error', error => { res.writeHead(502); res.end(error.message); });
    req.pipe(upstream);
});
server.listen(0, '127.0.0.1', () => console.log('http://127.0.0.1:' + server.address().port));
