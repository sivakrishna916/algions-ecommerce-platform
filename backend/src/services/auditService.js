const AuditLog = require('../models/AuditLog');

/**
 * Records a material business action. Failure to write the log must never break the business action,
 * so errors are swallowed (and printed outside tests).
 */
async function record(actor, action, entityType, entityId, summary, meta) {
  try {
    await AuditLog.create({
      actor: actor && actor._id,
      actorRole: actor && actor.role,
      actorEmail: actor && actor.email,
      action,
      entityType,
      entityId: entityId ? String(entityId) : undefined,
      summary,
      meta,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') console.error('audit log failed', err.message);
  }
}

module.exports = { record };
