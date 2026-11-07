const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorRole: { type: String },
    actorEmail: { type: String },
    action: { type: String, required: true, index: true }, // e.g. "product.update"
    entityType: { type: String, required: true },
    entityId: { type: String },
    summary: { type: String },
    meta: { type: Object },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
