import crypto from 'node:crypto';
import { validateActionRequest } from './safety.js';

class ActionLogManager {
  constructor() {
    this.actions = new Map(); // action_id -> action record
    this.emailStates = new Map(); // email_id -> current state
    this.knownClassifications = new Map(); // email_id -> classification meta
    this.reversals = [];
  }

  registerClassifications(classifications) {
    for (const c of classifications) {
      this.knownClassifications.set(c.id, c);
    }
  }

  applyActions(actionItems) {
    const applied = [];
    const rejected = [];

    for (const item of actionItems) {
      const emailId = item.email_id;
      const requestedAction = item.action;
      const meta = this.knownClassifications.get(emailId);

      const check = validateActionRequest(emailId, requestedAction, meta);
      if (!check.valid) {
        rejected.push({
          email_id: emailId,
          reason: check.reason,
        });
        continue;
      }

      const actionId = `act-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const appliedAt = new Date().toISOString();

      const record = {
        action_id: actionId,
        email_id: emailId,
        action: requestedAction,
        applied_at: appliedAt,
        undone: false,
      };

      this.actions.set(actionId, record);
      this.emailStates.set(emailId, requestedAction);

      applied.push({
        action_id: actionId,
        email_id: emailId,
        action: requestedAction,
        applied_at: appliedAt,
      });
    }

    return { applied, rejected };
  }

  undoActions(actionIds) {
    const undone = [];
    const failed = [];

    for (const id of actionIds) {
      const record = this.actions.get(id);
      if (!record) {
        failed.push({
          action_id: id,
          reason: 'Action ID not found',
        });
        continue;
      }

      if (record.undone) {
        failed.push({
          action_id: id,
          reason: 'Action already undone',
        });
        continue;
      }

      record.undone = true;
      record.undone_at = new Date().toISOString();
      this.emailStates.delete(record.email_id);
      this.reversals.push(record);
      undone.push(id);
    }

    return { undone, failed };
  }

  getSummary() {
    let totalReviewed = this.knownClassifications.size;
    let archived = 0;
    let labeledReadLater = 0;
    let flaggedImportant = 0;
    let leftInInbox = 0;
    let uncertainUnmodified = 0;
    let highPriorityProtected = 0;

    for (const [emailId, meta] of this.knownClassifications.entries()) {
      const currentState = this.emailStates.get(emailId);

      if (currentState === 'archive') {
        archived++;
      } else if (currentState === 'label_read_later') {
        labeledReadLater++;
      } else if (currentState === 'flag_important') {
        flaggedImportant++;
      } else if (currentState === 'leave_in_inbox') {
        leftInInbox++;
      }

      if (meta.category === 'uncertain') {
        // If not archived or still untouched
        uncertainUnmodified++;
      }

      if (meta.priority === 'high') {
        highPriorityProtected++;
      }
    }

    // If actions were applied for emails not pre-registered in classification
    if (totalReviewed === 0 && this.emailStates.size > 0) {
      totalReviewed = this.emailStates.size;
      for (const [, state] of this.emailStates.entries()) {
        if (state === 'archive') archived++;
        if (state === 'label_read_later') labeledReadLater++;
        if (state === 'flag_important') flaggedImportant++;
        if (state === 'leave_in_inbox') leftInInbox++;
      }
    }

    return {
      total_reviewed: totalReviewed,
      archived,
      labeled_read_later: labeledReadLater,
      flagged_important: flaggedImportant,
      left_in_inbox: leftInInbox,
      uncertain_unmodified: uncertainUnmodified,
      high_priority_protected: highPriorityProtected,
    };
  }
}

export const actionLog = new ActionLogManager();
