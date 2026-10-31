/**
 * Hard safety enforcement layer for Inbox Quest.
 * Mandated rules:
 * 1. Any item with confidence < 0.85 MUST have suggested_action = "needs_review".
 * 2. suggested_action NEVER equals "delete".
 * 3. archive is forbidden for priority == "high" and forbidden for category == "uncertain".
 */

export function sanitizeClassification(item) {
  const sanitized = { ...item };

  // Confidence clamp
  const confidence = typeof sanitized.confidence === 'number' ? sanitized.confidence : 0.0;
  sanitized.confidence = Math.max(0.0, Math.min(1.0, confidence));

  // Category fallback
  const validCategories = ['promotion', 'newsletter', 'important', 'receipt_bill', 'read_later', 'uncertain'];
  if (!validCategories.includes(sanitized.category)) {
    sanitized.category = 'uncertain';
  }

  // Priority fallback
  const validPriorities = ['high', 'medium', 'low'];
  if (!validPriorities.includes(sanitized.priority)) {
    sanitized.priority = sanitized.category === 'important' ? 'high' : 'medium';
  }

  // Action baseline
  let action = sanitized.suggested_action;

  // Never allow delete
  if (action === 'delete') {
    action = 'leave_in_inbox';
    sanitized.reason = `${sanitized.reason || ''} [Safety: deletion forbidden, reverted to leave_in_inbox]`.trim();
  }

  // Confidence check
  if (sanitized.confidence < 0.85) {
    action = 'needs_review';
  }

  // High priority cannot be archived
  if (sanitized.priority === 'high' && action === 'archive') {
    action = 'flag_important';
    sanitized.reason = `${sanitized.reason || ''} [Safety: high priority email protected from archiving]`.trim();
  }

  // Uncertain cannot be archived
  if (sanitized.category === 'uncertain' && action === 'archive') {
    action = 'leave_in_inbox';
    sanitized.reason = `${sanitized.reason || ''} [Safety: uncertain email protected from archiving]`.trim();
  }

  // Ensure action is valid
  const validActions = ['archive', 'label_read_later', 'flag_important', 'leave_in_inbox', 'needs_review'];
  if (!validActions.includes(action)) {
    action = 'needs_review';
  }

  sanitized.suggested_action = action;
  return sanitized;
}

export function validateActionRequest(emailId, action, emailMeta) {
  if (action === 'delete') {
    return { valid: false, reason: 'Deletions are forbidden' };
  }

  const validActions = ['archive', 'label_read_later', 'flag_important', 'leave_in_inbox'];
  if (!validActions.includes(action)) {
    return { valid: false, reason: `Invalid action '${action}' requested` };
  }

  if (action === 'archive' && emailMeta) {
    if (emailMeta.priority === 'high' || emailMeta.category === 'uncertain') {
      return { valid: false, reason: 'Cannot archive high-priority or uncertain email' };
    }
  }

  return { valid: true };
}
