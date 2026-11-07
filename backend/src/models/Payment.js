const mongoose = require('mongoose');

/** One document per payment attempt. Card numbers are never stored — only the last 4 digits. */
const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ['card', 'upi'], required: true },
    instrument: { type: String }, // "•••• 4242" or the UPI handle domain
    status: { type: String, enum: ['SUCCEEDED', 'FAILED', 'REFUNDED'], required: true, index: true },
    providerRef: { type: String },
    failureCode: String,
    failureReason: String,
    refundedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
