import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const nginxPort = Number(process.env.NGINX_PORT) || 8080;
const envPort = Number(process.env.PORT);
const PORT =
  envPort && envPort !== nginxPort ? envPort : Number(process.env.DEFAULT_APP_PORT) || 3000;
const HOST = '0.0.0.0';

app.use((req, res, next) => {
  const reqPath = req.path.toLowerCase();
  if (
    reqPath === '/server.js' ||
    reqPath === '/package.json' ||
    reqPath === '/package-lock.json' ||
    reqPath === '/metadata.json' ||
    reqPath.startsWith('/node_modules/')
  ) {
    return res.status(404).send('Not found');
  }
  next();
});

app.use(
  express.static(__dirname, {
    dotfiles: 'ignore',
    index: ['index.html'],
  })
);

app.listen(PORT, HOST, () => {
  console.log(`Static games server listening at http://${HOST}:${PORT}`);
});
