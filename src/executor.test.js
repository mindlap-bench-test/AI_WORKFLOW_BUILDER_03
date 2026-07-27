import { test } from 'node:test';
import assert from 'node:assert';
import * as db from './db.js';
import { executeWorkflow } from './executor.js';

async function setup() {
  await db.initialize();
}

async function cleanup() {
  try {
    await db.query('DELETE FROM logs');
    await db.query('DELETE FROM executions');
    await db.query('DELETE FROM triggers');
    await db.query('DELETE FROM steps');
    await db.query('DELETE FROM workflows');
  } catch (error) {
    // Tables might not exist yet
  }
}

async function createTestWorkflow(name = 'Test Workflow') {
  const result = await db.query(
    'INSERT INTO workflows (name, enabled) VALUES ($1, $2) RETURNING id',
    [name, true]
  );
  return result.rows[0].id;
}

async function createTestTrigger(workflowId, type = 'manual') {
  const result = await db.query(
    'INSERT INTO triggers (workflow_id, type, enabled) VALUES ($1, $2, $3) RETURNING id',
    [workflowId, type, true]
  );
  return result.rows[0].id;
}

async function createTestStep(workflowId, type, config, order) {
  const result = await db.query(
    'INSERT INTO steps (workflow_id, type, config, "order") VALUES ($1, $2, $3, $4) RETURNING id',
    [workflowId, type, config || null, order]
  );
  return result.rows[0].id;
}

async function createExecution(workflowId, triggerId) {
  const result = await db.query(
    'INSERT INTO executions (workflow_id, trigger_id, status) VALUES ($1, $2, $3) RETURNING id',
    [workflowId, triggerId, 'pending']
  );
  return result.rows[0].id;
}

test('executor module exports executeWorkflow function', () => {
  assert(typeof executeWorkflow === 'function', 'executeWorkflow should be exported');
});

test('execute workflow with single send_email step', async () => {
  await setup();
  await cleanup();

  const workflowId = await createTestWorkflow('Email Workflow');
  const triggerId = await createTestTrigger(workflowId);
  const stepId = await createTestStep(
    workflowId,
    'send_email',
    { to: 'test@example.com', subject: 'Test', body: 'Test body' },
    1
  );
  const executionId = await createExecution(workflowId, triggerId);

  const result = await executeWorkflow(executionId);

  assert.strictEqual(result.status, 'completed', 'Execution should be completed');
  assert.strictEqual(result.logs.length, 1, 'Should have one log entry');
  assert.strictEqual(result.logs[0].status, 'completed', 'Log should be completed');
  assert.strictEqual(result.logs[0].action_type, 'send_email', 'Action type should be send_email');
  assert(result.logs[0].result, 'Should have result');

  const logResult = await db.query('SELECT * FROM logs WHERE execution_id = $1', [executionId]);
  assert.strictEqual(logResult.rows.length, 1, 'Should have one log in database');

  await cleanup();
});

test('execute workflow with single ai_prompt step', async () => {
  await setup();
  await cleanup();

  const workflowId = await createTestWorkflow('AI Prompt Workflow');
  const triggerId = await createTestTrigger(workflowId);
  const stepId = await createTestStep(
    workflowId,
    'ai_prompt',
    { prompt: 'What is 2+2?' },
    1
  );
  const executionId = await createExecution(workflowId, triggerId);

  const result = await executeWorkflow(executionId);

  assert.strictEqual(result.status, 'completed', 'Execution should be completed');
  assert.strictEqual(result.logs.length, 1, 'Should have one log entry');
  assert.strictEqual(result.logs[0].status, 'completed', 'Log should be completed');
  assert.strictEqual(result.logs[0].action_type, 'ai_prompt', 'Action type should be ai_prompt');

  await cleanup();
});

test('step action throws error', async () => {
  await setup();
  await cleanup();

  const workflowId = await createTestWorkflow('Error Workflow');
  const triggerId = await createTestTrigger(workflowId);
  const stepId = await createTestStep(
    workflowId,
    'send_email',
    { subject: 'No recipient' }, // Missing required 'to' field
    1
  );
  const executionId = await createExecution(workflowId, triggerId);

  const result = await executeWorkflow(executionId);

  assert.strictEqual(result.status, 'failed', 'Execution should be failed');
  assert.strictEqual(result.logs.length, 1, 'Should have one log entry');
  assert.strictEqual(result.logs[0].status, 'failed', 'Log should be failed');
  assert(result.logs[0].error, 'Should have error message');

  const executionRow = await db.query('SELECT status FROM executions WHERE id = $1', [executionId]);
  assert.strictEqual(executionRow.rows[0].status, 'failed', 'Database should mark execution as failed');

  await cleanup();
});

test('multiple steps in sequence', async () => {
  await setup();
  await cleanup();

  const workflowId = await createTestWorkflow('Multi-step Workflow');
  const triggerId = await createTestTrigger(workflowId);

  await createTestStep(
    workflowId,
    'send_email',
    { to: 'user@example.com', subject: 'Step 1', body: 'First email' },
    1
  );
  await createTestStep(
    workflowId,
    'ai_prompt',
    { prompt: 'Summarize the email' },
    2
  );

  const executionId = await createExecution(workflowId, triggerId);
  const result = await executeWorkflow(executionId);

  assert.strictEqual(result.status, 'completed', 'Execution should be completed');
  assert.strictEqual(result.logs.length, 2, 'Should have two log entries');
  assert.strictEqual(result.logs[0].action_type, 'send_email', 'First step should be send_email');
  assert.strictEqual(result.logs[1].action_type, 'ai_prompt', 'Second step should be ai_prompt');

  const logsResult = await db.query('SELECT * FROM logs WHERE execution_id = $1 ORDER BY created_at', [executionId]);
  assert.strictEqual(logsResult.rows.length, 2, 'Database should have two logs');

  await cleanup();
});

test('execution stops on first failed step in multi-step workflow', async () => {
  await setup();
  await cleanup();

  const workflowId = await createTestWorkflow('Fail-on-first Workflow');
  const triggerId = await createTestTrigger(workflowId);

  await createTestStep(
    workflowId,
    'send_email',
    { to: 'user@example.com', subject: 'Step 1', body: 'First email' },
    1
  );
  await createTestStep(
    workflowId,
    'send_email',
    { subject: 'Missing recipient' }, // This will fail
    2
  );
  await createTestStep(
    workflowId,
    'ai_prompt',
    { prompt: 'This should not run' },
    3
  );

  const executionId = await createExecution(workflowId, triggerId);
  const result = await executeWorkflow(executionId);

  assert.strictEqual(result.status, 'failed', 'Execution should be failed');
  assert.strictEqual(result.logs.length, 2, 'Should have two log entries (first succeeded, second failed)');
  assert.strictEqual(result.logs[0].status, 'completed', 'First step should be completed');
  assert.strictEqual(result.logs[1].status, 'failed', 'Second step should be failed');

  const logsResult = await db.query('SELECT * FROM logs WHERE execution_id = $1', [executionId]);
  assert.strictEqual(logsResult.rows.length, 2, 'Database should have two logs, third step should not run');

  await cleanup();
});

test('trigger not found throws error', async () => {
  await setup();
  await cleanup();

  const workflowId = await createTestWorkflow('Test Workflow');

  const executionResult = await db.query(
    'INSERT INTO executions (workflow_id, trigger_id, status) VALUES ($1, $2, $3) RETURNING id',
    [workflowId, 9999, 'pending'] // Non-existent trigger
  );

  const executionId = executionResult.rows[0].id;

  try {
    await executeWorkflow(executionId);
    assert.fail('Should have thrown an error');
  } catch (error) {
    assert(error.message.includes('not found'), 'Error should mention not found');
  }

  await cleanup();
});
