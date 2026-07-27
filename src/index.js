import 'dotenv/config';
import app from './app.js';
import * as db from './db.js';

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await db.initialize();
    console.log('Database initialized');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing gracefully');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing gracefully');
  await db.close();
  process.exit(0);
});

start();
