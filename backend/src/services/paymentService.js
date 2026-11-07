const crypto = require('crypto');

/** Luhn checksum — rejects mistyped card numbers before the "gateway" is called. */
function luhnValid(num) {
  let sum = 0; let alt = false;
  for (let i = num.length - 1; i >= 0; i -= 1) {
    let d = parseInt(num[i], 10);
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d; alt = !alt;
  }
  return sum % 10 === 0;
}

const FAIL_CARDS = {
  '4000000000000002': ['CARD_DECLINED', 'Your card was declined'],
  '4000000000009995': ['INSUFFICIENT_FUNDS', 'Insufficient funds on the card'],
  '4000000000000119': ['PROCESSING_ERROR', 'The bank could not process the payment, please retry'],
};

/**
 * Sandbox gateway. Deterministic by design so it can be demonstrated and tested:
 *  card 4242 4242 4242 4242 (and any other valid number) → success
 *  4000 0000 0000 0002 → declined, ...9995 → insufficient funds, ...0119 → processing error
 *  UPI id ending in @fail → declined; any other UPI id → success
 * No real money, no real network call. Raw card numbers are never stored.
 */
function simulateCharge(payment) {
  if (payment.method === 'card') {
    const number = payment.number.replace(/\s|-/g, '');
    const instrument = `•••• ${number.slice(-4)}`;
    if (FAIL_CARDS[number]) {
      const [failureCode, failureReason] = FAIL_CARDS[number];
      return { status: 'FAILED', instrument, failureCode, failureReason };
    }
    return { status: 'SUCCEEDED', instrument, providerRef: `sim_${crypto.randomBytes(8).toString('hex')}` };
  }
  const handle = payment.vpa.toLowerCase();
  const instrument = `UPI ${handle.split('@')[1]}`;
  if (handle.endsWith('@fail')) return { status: 'FAILED', instrument, failureCode: 'UPI_DECLINED', failureReason: 'UPI request was declined' };
  return { status: 'SUCCEEDED', instrument, providerRef: `sim_${crypto.randomBytes(8).toString('hex')}` };
}

module.exports = { simulateCharge, luhnValid };
