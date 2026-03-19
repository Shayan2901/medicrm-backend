const db = require('../config/db');

// Fire all webhooks for a given event type
async function fireWebhook(eventType, payload) {
  try {
    const [hooks] = await db.query(
      'SELECT url FROM webhooks WHERE event_type = ? AND is_active = 1', [eventType]);
    for (const hook of hooks) {
      // Fire and forget — don't await
      fetch(hook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event:     eventType,
          timestamp: new Date().toISOString(),
          source:    'MediCRM',
          data:      payload,
        }),
      }).catch(err => console.error(`Webhook failed [${eventType}]:`, err.message));
    }
  } catch (err) {
    console.error('fireWebhook error:', err.message);
  }
}

module.exports = { fireWebhook };
