const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, max: 10, validate: Number.isInteger },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: { type: [cartItemSchema], default: [] },
    couponCode: { type: String, uppercase: true, trim: true },
    checkoutLockedAt: { type: Date }, // short-lived lock: one checkout per cart at a time
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cart', cartSchema);
