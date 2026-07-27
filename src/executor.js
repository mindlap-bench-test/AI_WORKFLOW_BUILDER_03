import * as db from './db.js';

async function executeWorkflow(executionId) {
  try {
    const executionResult = await db.query(
      'SELECT id, workflow_id, trigger_id, status FROM executions WHERE id = $1',
      [executionId]
    );

    if (executionResult.rows.length === 0) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const execution = executionResult.rows[0];

    const workflowResult = await db.query(
      'SELECT id, name, enabled FROM workflows WHERE id = $1',
      [execution.workflow_id]
    );

    if (workflowResult.rows.length === 0) {
      throw new Error(`Workflow ${execution.workflow_id} not found`);
    }

    const workflow = workflowResult.rows[0];

    if (!workflow.enabled) {
      throw new Error(`Workflow ${workflow.id} is disabled`);
    }

    const triggerResult = await db.query(
      'SELECT id, type, config, enabled FROM triggers WHERE id = $1',
      [execution.trigger_id]
    );

    if (triggerResult.rows.length === 0) {
      throw new Error(`Trigger ${execution.trigger_id} not found`);
    }

    const trigger = triggerResult.rows[0];

    if (!trigger.enabled) {
      throw new Error(`Trigger ${trigger.id} is disabled`);
    }

    const stepsResult = await db.query(
      'SELECT id, type, config FROM steps WHERE workflow_id = $1 ORDER BY "order"',
      [execution.workflow_id]
    );

    const steps = stepsResult.rows;
    const logs = [];
    const stepOutputs = {};

    await db.query(
      'UPDATE executions SET status = $1 WHERE id = $2',
      ['running', executionId]
    );

    for (const step of steps) {
      try {
        const actionType = step.type;
        let result;

        if (actionType === 'send_email') {
          result = await sendEmail(step.config, { execution, step, stepOutputs });
        } else if (actionType === 'ai_prompt') {
          result = await aiPrompt(step.config, { execution, step, stepOutputs });
        } else {
          throw new Error(`Unknown action type: ${actionType}`);
        }

        stepOutputs[step.id] = result;

        await db.query(
          `INSERT INTO logs (execution_id, step_id, action_type, status, result)
           VALUES ($1, $2, $3, $4, $5)`,
          [executionId, step.id, actionType, 'completed', JSON.stringify(result)]
        );

        logs.push({
          id: step.id,
          action_type: actionType,
          status: 'completed',
          result
        });
      } catch (error) {
        const errorMsg = error.message;

        await db.query(
          `INSERT INTO logs (execution_id, step_id, action_type, status, error)
           VALUES ($1, $2, $3, $4, $5)`,
          [executionId, step.id, step.type, 'failed', errorMsg]
        );

        logs.push({
          id: step.id,
          action_type: step.type,
          status: 'failed',
          error: errorMsg
        });

        await db.query(
          'UPDATE executions SET status = $1, completed_at = NOW() WHERE id = $2',
          ['failed', executionId]
        );

        return {
          id: execution.id,
          workflow_id: execution.workflow_id,
          trigger_id: execution.trigger_id,
          status: 'failed',
          logs
        };
      }
    }

    await db.query(
      'UPDATE executions SET status = $1, completed_at = NOW() WHERE id = $2',
      ['completed', executionId]
    );

    return {
      id: execution.id,
      workflow_id: execution.workflow_id,
      trigger_id: execution.trigger_id,
      status: 'completed',
      logs
    };
  } catch (error) {
    console.error(`Failed to execute workflow ${executionId}:`, error);
    throw error;
  }
}

async function sendEmail(config, context) {
  const { to, subject, body } = config || {};

  if (!to || !subject || !body) {
    throw new Error('Email action requires to, subject, and body in config');
  }

  console.log(`Mock sending email to ${to} with subject "${subject}"`);

  return {
    sent: true,
    to,
    subject,
    timestamp: new Date().toISOString()
  };
}

async function aiPrompt(config, context) {
  const { prompt } = config || {};

  if (!prompt) {
    throw new Error('AI Prompt action requires prompt in config');
  }

  console.log(`Mock executing AI prompt: "${prompt}"`);

  return {
    executed: true,
    prompt,
    response: 'This is a mocked response from the AI.',
    timestamp: new Date().toISOString()
  };
}

export { executeWorkflow };
