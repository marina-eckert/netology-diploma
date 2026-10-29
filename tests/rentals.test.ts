import { test } from "node:test";
import assert from "node:assert/strict";
import { peakReservations } from "../server/availability.js";
const d = (n: number) => new Date(2030, 0, n);
test("disjoint bookings do not consume two copies at once", () => {
  assert.equal(
    peakReservations(
      [
        { dateStart: d(2), dateEnd: d(4) },
        { dateStart: d(4), dateEnd: d(6) },
      ],
      d(1),
      d(8),
    ),
    1,
  );
});
test("intersecting bookings consume distinct copies", () => {
  assert.equal(
    peakReservations(
      [
        { dateStart: d(2), dateEnd: d(5) },
        { dateStart: d(4), dateEnd: d(6) },
      ],
      d(1),
      d(8),
    ),
    2,
  );
});
test("bookings outside selected interval are ignored", () => {
  assert.equal(
    peakReservations([{ dateStart: d(2), dateEnd: d(4) }], d(4), d(8)),
    0,
  );
});
