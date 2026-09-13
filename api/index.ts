import app from '../server/app.js';

// Vite serves the frontend; this function handles every /api/* request.
export const config = { api: { bodyParser: false } };
export default app;
