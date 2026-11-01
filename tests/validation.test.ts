import { test } from "node:test";
import assert from "node:assert/strict";
import { password } from "../server/validation.js";
test("password whitespace is significant", () =>
  assert.equal(password("  Library123!  "), "  Library123!  "));
test("bcrypt passwords cannot silently truncate after 72 UTF-8 bytes", () => {
  assert.throws(() => password("a".repeat(73)));
  assert.throws(() => password("я".repeat(37)));
  assert.equal(password("я".repeat(36)), "я".repeat(36));
});
