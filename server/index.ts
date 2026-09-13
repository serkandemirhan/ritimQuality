import 'dotenv/config';
import app from './app.js';
import { startNotificationWorker } from './services/push.js';
const port = Number(process.env.API_PORT || 3001);
app.listen(port, () => console.log(`QualiTrack API listening on http://localhost:${port}`));
startNotificationWorker();
