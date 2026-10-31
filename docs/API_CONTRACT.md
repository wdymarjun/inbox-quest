# Inbox Quest API Contract

Base URL in local development: `http://localhost:3001`

---

## 1. GET `/api/inbox?size=10|25|50`

Fetches a batch of simulated or demo inbox emails.

### Request Query Parameters
- `size` (optional, default: `25`): Batch size, must be `10`, `25`, or `50`.

### Response (200 OK)
An array of email objects:
```json
[
  {
    "id": "string",
    "sender": "string",
    "subject": "string",
    "snippet": "string",
    "date": "YYYY-MM-DD"
  }
]
```

---

## 2. POST `/api/classify`

Classifies a batch of emails using rule-based heuristics and optional Gemini structured reasoning.

### Request Body
```json
{
  "emails": [
    {
      "id": "string",
      "sender": "string",
      "subject": "string",
      "snippet": "string",
      "date": "YYYY-MM-DD"
    }
  ]
}
```

### Response (200 OK)
An array of classification results:
```json
[
  {
    "id": "string",
    "category": "promotion | newsletter | important | receipt_bill | read_later | uncertain",
    "priority": "high | medium | low",
    "confidence": 0.0,
    "reason": "string",
    "suggested_action": "archive | label_read_later | flag_important | leave_in_inbox | needs_review"
  }
]
```

### Hard Safety Rules Mandated by Contract
- Any item with `confidence < 0.85` **MUST** have `suggested_action: "needs_review"`.
- `suggested_action` **NEVER** equals `"delete"`.
- `archive` is forbidden for `priority: "high"` and forbidden for `category: "uncertain"`.

---

## 3. POST `/api/actions/apply`

Applies a batch of inbox actions with safety guardrails and audit logging.

### Request Body
```json
{
  "actions": [
    {
      "email_id": "string",
      "action": "archive | label_read_later | flag_important | leave_in_inbox"
    }
  ]
}
```

### Response (200 OK)
```json
{
  "applied": [
    {
      "action_id": "string",
      "email_id": "string",
      "action": "string",
      "applied_at": "ISO-8601 string"
    }
  ],
  "rejected": [
    {
      "email_id": "string",
      "reason": "string"
    }
  ]
}
```

### Safety Rules
- Any action `delete` **must** be rejected with `"Deletions are forbidden"`.
- Applying `archive` on high-priority or uncertain emails **must** be rejected with `"Cannot archive high-priority or uncertain email"`.

---

## 4. POST `/api/actions/undo`

Reverses previously applied actions.

### Request Body
```json
{
  "action_ids": [
    "string"
  ]
}
```

### Response (200 OK)
```json
{
  "undone": [
    "string"
  ],
  "failed": [
    {
      "action_id": "string",
      "reason": "string"
    }
  ]
}
```

---

## 5. GET `/api/summary`

Retrieves audit metrics and summary of reviewed, organized, and protected emails.

### Response (200 OK)
```json
{
  "total_reviewed": 0,
  "archived": 0,
  "labeled_read_later": 0,
  "flagged_important": 0,
  "left_in_inbox": 0,
  "uncertain_unmodified": 0,
  "high_priority_protected": 0
}
```
