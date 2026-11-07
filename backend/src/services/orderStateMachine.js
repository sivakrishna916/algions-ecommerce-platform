/** Single source of truth for the order lifecycle. */
const TRANSITIONS = {
  PLACED: ['PAID', 'CANCELLED'],
  PAID: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

// Who may cancel from which state
const CANCELLABLE_BY = { customer: ['PLACED', 'PAID'], admin: ['PLACED', 'PAID', 'PACKED'] };

// Admins move fulfilment forward; PAID is only ever set by a successful payment (keeps money reconcilable).
const ADMIN_SETTABLE = ['PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

const canTransition = (from, to) => (TRANSITIONS[from] || []).includes(to);
const allowedNext = (from) => TRANSITIONS[from] || [];
const canCancel = (role, status) => (CANCELLABLE_BY[role] || []).includes(status);

module.exports = { TRANSITIONS, CANCELLABLE_BY, ADMIN_SETTABLE, canTransition, allowedNext, canCancel };
