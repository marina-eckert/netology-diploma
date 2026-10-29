/** Half-open intervals: a copy returned at dateEnd may be reserved at that instant. */
export function peakReservations(
  rows: { dateStart: any; dateEnd: any }[],
  start: Date,
  end: Date,
) {
  const events: [number, number][] = [];
  for (const r of rows) {
    const a = Math.max(+new Date(r.dateStart), +start),
      b = Math.min(+new Date(r.dateEnd), +end);
    if (a < b) events.push([a, 1], [b, -1]);
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let n = 0,
    peak = 0;
  for (const [, delta] of events) {
    n += delta;
    peak = Math.max(n, peak);
  }
  return peak;
}
