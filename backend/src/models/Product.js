const mongoose = require('mongoose');

/** Every product has >= 1 variant. Price and stock live on the variant (price in paise). */
const variantSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    label: { type: String, required: true, trim: true, maxlength: 60 }, // e.g. "Black / M"
    price: { type: Number, required: true, min: 1, validate: Number.isInteger },
    mrp: { type: Number, min: 1, validate: Number.isInteger },
    stock: { type: Number, required: true, min: 0, default: 0, validate: Number.isInteger },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 140 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, trim: true, maxlength: 4000, default: '' },
    brand: { type: String, trim: true, maxlength: 60 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    images: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    variants: {
      type: [variantSchema],
      validate: [
        { validator: (v) => v.length >= 1, message: 'A product needs at least one variant' },
        { validator: (v) => new Set(v.map((x) => x.sku)).size === v.length, message: 'Variant SKUs must be unique within a product' },
      ],
    },
    minPrice: { type: Number, required: true, index: true }, // denormalised for filter/sort
    soldCount: { type: Number, default: 0, min: 0 }, // popularity
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// SKUs are globally unique (multikey unique index)
productSchema.index({ 'variants.sku': 1 }, { unique: true });
productSchema.index({ isActive: 1, category: 1, minPrice: 1 });
productSchema.index({ isActive: 1, soldCount: -1 });
productSchema.index({ name: 'text', brand: 'text', tags: 'text' });

productSchema.pre('validate', function setMinPrice(next) {
  if (this.variants && this.variants.length) this.minPrice = Math.min(...this.variants.map((v) => v.price));
  next();
});

productSchema.virtual('totalStock').get(function totalStock() {
  return this.variants.reduce((s, v) => s + v.stock, 0);
});
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
