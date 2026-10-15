import { createApp } from '../src/server.js';

// Reuse application state within a warm Vercel function; do not open a port.
const app = createApp();
const requestHandler = app.listeners('request')[0];
export default function handler(req, res) {
  return requestHandler(req, res);
}
