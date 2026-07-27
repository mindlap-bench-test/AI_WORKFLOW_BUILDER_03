import express from 'express';
import * as db from './db.js';

const app = express();

app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.get('/health', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({
      status: 'ok',
      timestamp: result.rows[0].now,
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed'
    });
  }
});

app.get('/workflows', async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, description, enabled FROM workflows ORDER BY created_at DESC');
    res.json({
      workflows: result.rows
    });
  } catch (error) {
    console.error('Error fetching workflows', error);
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

app.get('/workflows/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const workflowResult = await db.query(
      'SELECT id, name, description, enabled FROM workflows WHERE id = $1',
      [id]
    );

    if (workflowResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const stepsResult = await db.query(
      'SELECT id, type, config, "order" FROM steps WHERE workflow_id = $1 ORDER BY "order"',
      [id]
    );

    res.json({
      workflow: workflowResult.rows[0],
      steps: stepsResult.rows
    });
  } catch (error) {
    console.error('Error fetching workflow', error);
    res.status(500).json({ error: 'Failed to fetch workflow' });
  }
});

app.post('/workflows', async (req, res) => {
  try {
    const { name, description, enabled } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Workflow name is required' });
    }

    const result = await db.query(
      'INSERT INTO workflows (name, description, enabled) VALUES ($1, $2, $3) RETURNING id, name, description, enabled',
      [name, description || null, enabled !== false]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating workflow', error);
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

app.post('/workflows/:id/steps', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, config, order } = req.body;

    if (!type || order === undefined) {
      return res.status(400).json({ error: 'Step type and order are required' });
    }

    const workflowCheck = await db.query('SELECT id FROM workflows WHERE id = $1', [id]);
    if (workflowCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const result = await db.query(
      'INSERT INTO steps (workflow_id, type, config, "order") VALUES ($1, $2, $3, $4) RETURNING id, type, config, "order"',
      [id, type, config || null, order]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating step', error);
    res.status(500).json({ error: 'Failed to create step' });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
