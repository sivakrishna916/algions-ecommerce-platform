/** Demo coupon configuration (amounts in paise). In a real system these would live in the database. */
module.exports = {
  WELCOME10: { type: 'percent', value: 10, maxDiscount: 50000, minSubtotal: 50000, description: '10% off (max ₹500) on orders above ₹500' },
  FLAT100: { type: 'flat', value: 10000, minSubtotal: 100000, description: '₹100 off on orders above ₹1000' },
};
