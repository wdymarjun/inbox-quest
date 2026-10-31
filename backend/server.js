import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { classifyEmails } from './classifier.js';
import { actionLog } from './actionLog.js';
import { askAssistant, validateAssistantInput, assistantRateLimiter } from './assistant/brain.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mockInboxPath = path.join(__dirname, 'data', 'mockInbox.json');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS setup: allow http://localhost:5173 and standard dev origins
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));

app.use(express.json());

// Load mock inbox data
let mockEmails = [];
try {
  const fileData = fs.readFileSync(mockInboxPath, 'utf8');
  mockEmails = JSON.parse(fileData);
} catch (err) {
  console.error('Failed to load mock inbox data:', err.message);
  mockEmails = [];
}

/**
 * GET /api/inbox?size=10|25|50
 */
app.get('/api/inbox', (req, res) => {
  const reqSize = parseInt(req.query.size, 10);
  let size = 25;
  if ([10, 25, 50].includes(reqSize)) {
    size = reqSize;
  } else if (!isNaN(reqSize)) {
    // nearest supported size
    if (reqSize <= 10) size = 10;
    else if (reqSize <= 25) size = 25;
    else size = 50;
  }

  const batch = mockEmails.slice(0, size);
  return res.json(batch);
});

/**
 * POST /api/classify
 */
app.post('/api/classify', async (req, res) => {
  const emails = req.body?.emails;
  if (!Array.isArray(emails)) {
    return res.status(400).json({ error: 'Request body must contain an "emails" array' });
  }

  try {
    const classifications = await classifyEmails(emails);
    actionLog.registerClassifications(classifications);
    return res.json(classifications);
  } catch (err) {
    console.error('Classification error:', err);
    return res.status(500).json({ error: 'Failed to classify emails' });
  }
});

/**
 * POST /api/actions/apply
 */
app.post('/api/actions/apply', (req, res) => {
  const actions = req.body?.actions;
  if (!Array.isArray(actions)) {
    return res.status(400).json({ error: 'Request body must contain an "actions" array' });
  }

  const result = actionLog.applyActions(actions);
  return res.json(result);
});

/**
 * POST /api/actions/undo
 */
app.post('/api/actions/undo', (req, res) => {
  const actionIds = req.body?.action_ids;
  if (!Array.isArray(actionIds)) {
    return res.status(400).json({ error: 'Request body must contain an "action_ids" array' });
  }

  const result = actionLog.undoActions(actionIds);
  return res.json(result);
});

/**
 * GET /api/summary
 */
app.get('/api/summary', (req, res) => {
  const summary = actionLog.getSummary();
  return res.json(summary);
});

/**
 * POST /api/assistant/chat
 * Dedicated, narrowly scoped help assistant for Inbox Quest
 */
export async function handleAssistantChat(req, res) {
  // 1. Rate limiting by IP
  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  if (assistantRateLimiter.isRateLimited(clientIp)) {
    return res.status(429).json({
      error: 'Too many requests. Please wait a moment before asking another question.',
    });
  }

  // 2. Input validation
  const validation = validateAssistantInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  // 3. Ask assistant brain
  try {
    const result = await askAssistant(validation.data);
    return res.json({ answer: result.answer });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      error: err.message || 'Assistant service encountered an issue.',
    });
  }
}

app.post('/api/assistant/chat', handleAssistantChat);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

let server;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`Inbox Quest backend running on http://localhost:${PORT}`);
  });
}

export { app, server };
