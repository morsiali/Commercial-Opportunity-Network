/* Explicit state machines for every commercial record, with an audit entry for each transition.
   Only the transitions listed here are allowed; anything else raises a structured DomainError. */
(function (root) {
  'use strict';
  const CON = root.CON = root.CON || {};

  class DomainError extends Error {
    constructor(code, details, message) { super(message || code); this.name = 'DomainError'; this.code = code; this.details = details || {}; }
    toJSON() { return { error: { code: this.code, message: this.message, details: this.details } }; }
  }

  /* machine: { state: { event: nextState } } */
  const MACHINES = {
    rfq: {
      open: { award: 'awarded', partial_award: 'partially_awarded', close: 'closed', cancel: 'cancelled', expire: 'expired' },
      partially_awarded: { award: 'awarded', close: 'closed' },
      awarded: {}, closed: {}, cancelled: {}, expired: {}
    },
    offer: { // one RFQ line
      requested: { offer: 'offered', decline: 'declined', expire: 'expired', cancel: 'cancelled' },
      offered: { revise: 'offered', accept: 'accepted', withdraw: 'withdrawn', expire: 'expired', decline: 'declined', cancel: 'cancelled' },
      accepted: { revise: 'offered', unaccept: 'offered', reserve: 'reserved', expire: 'expired', withdraw: 'withdrawn', cancel: 'cancelled' },
      reserved: { book: 'booked', release: 'accepted', expire: 'expired' },
      booked: {}, declined: {}, withdrawn: {}, expired: {}, cancelled: {}
    },
    reservation: {
      held: { confirm: 'confirmed', release: 'released', expire: 'expired' },
      confirmed: { release: 'released' },
      released: {}, expired: {}
    },
    payment: {
      awaiting: { pay: 'paid', fail: 'failed', cancel: 'cancelled', expire: 'expired' },
      paid: { refund_partial: 'partially_refunded', refund_full: 'refunded' },
      partially_refunded: { refund_partial: 'partially_refunded', refund_full: 'refunded' },
      failed: {}, cancelled: {}, expired: {}, refunded: {}
    },
    booking: {
      reserved: { confirm: 'confirmed', cancel: 'cancelled', expire: 'expired' },
      confirmed: { prepare: 'preparing', cancel: 'cancelled' },
      preparing: { go_live: 'live', cancel: 'cancelled' },
      live: { complete: 'completed', dispute: 'disputed' },
      completed: { accept_delivery: 'delivery_accepted', dispute: 'disputed' },
      disputed: { resolve_delivered: 'delivery_accepted', resolve_refund: 'refunded' },
      delivery_accepted: {}, cancelled: {}, expired: {}, refunded: {}
    },
    dispute: {
      open: { review: 'under_review', resolve_supplier: 'resolved_supplier', resolve_customer: 'resolved_customer', withdraw: 'withdrawn' },
      under_review: { resolve_supplier: 'resolved_supplier', resolve_customer: 'resolved_customer' },
      resolved_supplier: {}, resolved_customer: {}, withdrawn: {}
    },
    refund: {
      requested: { approve: 'approved', reject: 'rejected' },
      approved: { process: 'processed', fail: 'failed' },
      failed: { process: 'processed' },
      processed: {}, rejected: {}
    },
    payout: {
      held: { make_eligible: 'eligible', withhold: 'withheld', cancel: 'cancelled' },
      eligible: { release: 'released', start_release: 'releasing', withhold: 'withheld', cancel: 'cancelled' },
      /* Live mode only: claimed before the provider transfer, so two requests can never both move money. */
      releasing: { release: 'released', release_failed: 'eligible' },
      withheld: { make_eligible: 'eligible', cancel: 'cancelled', hold: 'held' },
      released: {}, cancelled: {}
    }
  };

  function can(machine, from, event) { const m = MACHINES[machine]; return !!(m && m[from] && m[from][event]); }
  function next(machine, from, event) {
    const m = MACHINES[machine];
    if (!m) throw new DomainError('STATE_UNKNOWN_MACHINE', { machine });
    if (!m[from]) throw new DomainError('STATE_UNKNOWN', { machine, from });
    const to = m[from][event];
    if (!to) throw new DomainError('STATE_TRANSITION_NOT_ALLOWED', { machine, from, event, allowed: Object.keys(m[from]) });
    return to;
  }
  /* Apply a transition to a record (mutates it) and append the audit entry to the log. */
  function transition(log, machine, record, event, meta) {
    const from = record.status;
    const to = next(machine, from, event);
    record.status = to;
    const at = (meta && meta.at) || new Date().toISOString();
    record.updatedAt = at;
    const entry = { id: 'au-' + (log.length + 1).toString(36) + '-' + Math.random().toString(36).slice(2, 7), at, actor: (meta && meta.actor) || 'system', entity: machine, entityId: record.id, event, from, to, reason: (meta && meta.reason) || '' };
    if (meta && meta.data) entry.data = meta.data;
    log.push(entry);
    return entry;
  }
  function audit(log, entity, entityId, event, meta) {
    const entry = { id: 'au-' + (log.length + 1).toString(36) + '-' + Math.random().toString(36).slice(2, 7), at: (meta && meta.at) || new Date().toISOString(), actor: (meta && meta.actor) || 'system', entity, entityId, event, from: null, to: null, reason: (meta && meta.reason) || '' };
    if (meta && meta.data) entry.data = meta.data;
    log.push(entry);
    return entry;
  }

  CON.States = { MACHINES, DomainError, can, next, transition, audit };
})(typeof window !== 'undefined' ? window : globalThis);
