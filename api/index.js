import { createApp } from '../src/server.js';

// Reuse application state within a warm Vercel function; do not open a port.
const app = createApp();
export default function handler(req, res) {
  return app.emit('request', req, res);
}
