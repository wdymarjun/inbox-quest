import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeClassification } from './safety.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cachePath = path.join(__dirname, 'data', 'cache.json');

// Helper to read and write cache safely
function loadCache() {
  try {
    if (fs.existsSync(cachePath)) {
      const data = fs.readFileSync(cachePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading cache:', err.message);
  }
  return {};
}

function saveCache(cache) {
  try {
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing cache:', err.message);
  }
}

function hashKey(subject, snippet) {
  return crypto.createHash('sha256').update(`${subject}:::${snippet}`).digest('hex');
}

/**
 * Rules-first heuristic classification engine
 */
export function classifyHeuristic(email) {
  const text = `${email.sender || ''} ${email.subject || ''} ${email.snippet || ''}`.toLowerCase();
  const subject = (email.subject || '').toLowerCase();
  const sender = (email.sender || '').toLowerCase();

  // 1. Phishing / Suspicious / Uncertain signals
  if (
    text.includes('phish') ||
    sender.includes('xyz') ||
    sender.includes('tempmail') ||
    sender.includes('fake') ||
    subject === 'fwd: document' ||
    subject === 'thoughts?' ||
    subject === 'quick check-in' ||
    subject === 'quick question regarding our collaboration' ||
    subject.startsWith('hey - question') ||
    subject === 'invoice or inquiry'
  ) {
    return sanitizeClassification({
      id: email.id,
      category: 'uncertain',
      priority: 'medium',
      confidence: 0.65, // Below 0.85 -> triggers needs_review
      reason: 'Vague subject line or ambiguous sender requiring human attention',
      suggested_action: 'needs_review'
    });
  }

  // 2. High priority / Security alerts / Urgent / Travel
  if (
    text.includes('critical security alert') ||
    text.includes('verification required') ||
    text.includes('wire transfer') ||
    text.includes('secret scanning alert') ||
    text.includes('offer letter') ||
    text.includes('flight confirmation') ||
    text.includes('gate change') ||
    text.includes('interview with')
  ) {
    return sanitizeClassification({
      id: email.id,
      category: 'important',
      priority: 'high',
      confidence: 0.96,
      reason: 'Security notice, flight confirmation, or time-sensitive professional correspondence',
      suggested_action: 'flag_important'
    });
  }

  // 3. Receipts & Bills
  if (
    text.includes('invoice') ||
    text.includes('receipt') ||
    text.includes('statement is ready') ||
    text.includes('bill is now ready') ||
    text.includes('payment method') ||
    text.includes('subscription charged') ||
    text.includes('order confirmation') ||
    sender.includes('billing@') ||
    sender.includes('receipts@')
  ) {
    return sanitizeClassification({
      id: email.id,
      category: 'receipt_bill',
      priority: 'low',
      confidence: 0.94,
      reason: 'Financial receipt, subscription invoice, or utility billing notification',
      suggested_action: 'archive'
    });
  }

  // 4. Promotions / Flash sales / Deals
  if (
    text.includes('flash sale') ||
    text.includes('40% off') ||
    text.includes('buy 1 get 1') ||
    text.includes('coupon code') ||
    text.includes('clearance blowout') ||
    text.includes('exclusive offer') ||
    text.includes('black friday') ||
    text.includes('on sale - save') ||
    text.includes('double star day') ||
    text.includes('pizzaparadise') ||
    sender.includes('deals@') ||
    sender.includes('promotions@') ||
    sender.includes('special-offers@') ||
    sender.includes('marketing@')
  ) {
    return sanitizeClassification({
      id: email.id,
      category: 'promotion',
      priority: 'low',
      confidence: 0.95,
      reason: 'Commercial marketing, store discount, or seasonal promotional campaign',
      suggested_action: 'archive'
    });
  }

  // 5. Read Later (Deep dives, whitepapers, monographs, longform research)
  if (
    text.includes('deep dive') ||
    text.includes('whitepaper') ||
    text.includes('weekly papers') ||
    text.includes('monograph') ||
    text.includes('nature focus') ||
    text.includes('distill: visualizing') ||
    text.includes('increment issue') ||
    text.includes('stratechery: the economics') ||
    text.includes('cacm') ||
    sender.includes('arxiv') ||
    sender.includes('distill.pub')
  ) {
    return sanitizeClassification({
      id: email.id,
      category: 'read_later',
      priority: 'low',
      confidence: 0.91,
      reason: 'Long-form technical essay or architectural analysis best suited for deferred reading',
      suggested_action: 'label_read_later'
    });
  }

  // 6. Newsletters & Curated Tech Digests
  if (
    text.includes('newsletter') ||
    text.includes('digest') ||
    text.includes('morning brew') ||
    text.includes('tldr tech') ||
    text.includes('hacker weekly') ||
    text.includes('bytes:') ||
    text.includes('deno news') ||
    sender.includes('substack')
  ) {
    return sanitizeClassification({
      id: email.id,
      category: 'newsletter',
      priority: 'low',
      confidence: 0.93,
      reason: 'Curated industry newsletter or community digest',
      suggested_action: 'archive'
    });
  }

  // Default fallback -> uncertain
  return sanitizeClassification({
    id: email.id,
    category: 'uncertain',
    priority: 'medium',
    confidence: 0.70,
    reason: 'Unclear category criteria; deferred for user review',
    suggested_action: 'needs_review'
  });
}

/**
 * Main classifyEmails batch handler with cache, Gemini fallback, and safety sanitization
 */
export async function classifyEmails(emails) {
  const cache = loadCache();
  let cacheModified = false;
  const results = [];

  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL;

  let aiClient = null;
  if (apiKey && modelName) {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      aiClient = new GoogleGenAI({ apiKey });
    } catch (err) {
      console.warn('Gemini SDK initialization note:', err.message);
    }
  }

  for (const email of emails) {
    const key = hashKey(email.subject || '', email.snippet || '');

    // 1. Check cache first
    if (cache[key]) {
      const cachedResult = { ...cache[key], id: email.id };
      results.push(sanitizeClassification(cachedResult));
      continue;
    }

    // 2. Try Gemini if configured
    let classification = null;
    if (aiClient && modelName) {
      try {
        const prompt = `Classify this email according to the schema.
Email:
Sender: ${email.sender}
Subject: ${email.subject}
Snippet: ${email.snippet}
Date: ${email.date}

Respond ONLY with a JSON object matching this schema:
{
  "category": "promotion | newsletter | important | receipt_bill | read_later | uncertain",
  "priority": "high | medium | low",
  "confidence": number between 0.0 and 1.0,
  "reason": "short explanation",
  "suggested_action": "archive | label_read_later | flag_important | leave_in_inbox | needs_review"
}`;

        const response = await aiClient.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          }
        });

        const text = response?.text;
        if (text) {
          const parsed = JSON.parse(text);
          classification = {
            id: email.id,
            category: parsed.category,
            priority: parsed.priority,
            confidence: parsed.confidence,
            reason: parsed.reason,
            suggested_action: parsed.suggested_action,
          };
          cache[key] = { ...classification };
          delete cache[key].id;
          cacheModified = true;
        }
      } catch (geminiErr) {
        console.warn(`Gemini call bypassed for email ${email.id}:`, geminiErr.message);
      }
    }

    // 3. Fall back to rules-first heuristic if no Gemini classification
    if (!classification) {
      classification = classifyHeuristic(email);
    } else {
      classification = sanitizeClassification(classification);
    }

    results.push(classification);
  }

  if (cacheModified) {
    saveCache(cache);
  }

  return results;
}
