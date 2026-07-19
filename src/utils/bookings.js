/*
 * Date-scoped bookings for weekly-recurring classes.
 *
 * Legacy shape: cls.bookings / cls.waitlist = [memberIds] — a STANDING weekly
 * reservation (the member is booked every week). Still honored everywhere.
 *
 * New shape: cls.bookingsByDate / cls.waitlistByDate = { 'YYYY-MM-DD': [ids] }
 * — a booking for one specific occurrence. This is what lets clients book
 * weeks ahead: booking Aug 5 books ONLY Aug 5.
 */

export function getBookingsOn(cls, dateISO) {
  return [...(cls.bookings || []), ...(((cls.bookingsByDate || {})[dateISO]) || [])];
}

export function getWaitlistOn(cls, dateISO) {
  return [...(cls.waitlist || []), ...(((cls.waitlistByDate || {})[dateISO]) || [])];
}

export function isBookedOn(cls, dateISO, memberId) {
  return getBookingsOn(cls, dateISO).includes(memberId);
}

export function isWaitlistedOn(cls, dateISO, memberId) {
  return getWaitlistOn(cls, dateISO).includes(memberId);
}

/** Book a member for one date. Full class → waitlist. Returns a new class object. */
export function addBookingOn(cls, dateISO, memberId) {
  if (isBookedOn(cls, dateISO, memberId)) return cls;
  const byDate = { ...(cls.bookingsByDate || {}) };
  const wlByDate = { ...(cls.waitlistByDate || {}) };
  if (getBookingsOn(cls, dateISO).length < (cls.capacity || Infinity)) {
    byDate[dateISO] = [...(byDate[dateISO] || []), memberId];
    return { ...cls, bookingsByDate: byDate };
  }
  if (!isWaitlistedOn(cls, dateISO, memberId)) {
    wlByDate[dateISO] = [...(wlByDate[dateISO] || []), memberId];
  }
  return { ...cls, waitlistByDate: wlByDate };
}

/**
 * Cancel a member's spot for one date. Removes a date-scoped booking first;
 * falls back to removing a legacy standing booking (which cancels their
 * weekly reservation, matching the old behavior). Promotes the date's first
 * waitlisted member into the freed spot.
 */
export function removeBookingOn(cls, dateISO, memberId) {
  let next = { ...cls };
  const byDate = { ...(next.bookingsByDate || {}) };
  const dateList = byDate[dateISO] || [];
  if (dateList.includes(memberId)) {
    byDate[dateISO] = dateList.filter(id => id !== memberId);
    if (byDate[dateISO].length === 0) delete byDate[dateISO];
    next.bookingsByDate = byDate;
  } else if ((next.bookings || []).includes(memberId)) {
    next.bookings = next.bookings.filter(id => id !== memberId);
  } else {
    // maybe they're only waitlisted
    const wl = { ...(next.waitlistByDate || {}) };
    if ((wl[dateISO] || []).includes(memberId)) {
      wl[dateISO] = wl[dateISO].filter(id => id !== memberId);
      if (wl[dateISO].length === 0) delete wl[dateISO];
      next.waitlistByDate = wl;
    }
    if ((next.waitlist || []).includes(memberId)) {
      next.waitlist = next.waitlist.filter(id => id !== memberId);
    }
    return next;
  }
  // Promote from that date's waitlist (date-scoped first, then legacy)
  if (getBookingsOn(next, dateISO).length < (next.capacity || Infinity)) {
    const wl = { ...(next.waitlistByDate || {}) };
    if ((wl[dateISO] || []).length > 0) {
      const [promoted, ...rest] = wl[dateISO];
      rest.length === 0 ? delete wl[dateISO] : (wl[dateISO] = rest);
      next.waitlistByDate = wl;
      const byD = { ...(next.bookingsByDate || {}) };
      byD[dateISO] = [...(byD[dateISO] || []), promoted];
      next.bookingsByDate = byD;
    }
  }
  return next;
}

/** Drop per-date entries older than `beforeISO` (housekeeping on write). */
export function pruneOldDateBookings(cls, beforeISO) {
  const prune = (obj) => {
    if (!obj) return undefined;
    const out = {};
    for (const [d, list] of Object.entries(obj)) {
      if (d >= beforeISO && list.length) out[d] = list;
    }
    return Object.keys(out).length ? out : undefined;
  };
  const bookingsByDate = prune(cls.bookingsByDate);
  const waitlistByDate = prune(cls.waitlistByDate);
  const next = { ...cls };
  if (bookingsByDate) next.bookingsByDate = bookingsByDate; else delete next.bookingsByDate;
  if (waitlistByDate) next.waitlistByDate = waitlistByDate; else delete next.waitlistByDate;
  return next;
}
