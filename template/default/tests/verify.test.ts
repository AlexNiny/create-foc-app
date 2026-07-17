import assert from "node:assert/strict";
import test from "node:test";

import { equalBytes, MIN_UPLOAD_BYTES, toPayloadBytes } from "../lib/foc/verify";

test("equalBytes accepts identical byte arrays", () => {
  assert.equal(equalBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])), true);
});

test("equalBytes rejects changed or truncated arrays", () => {
  assert.equal(equalBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 9, 3])), false);
  assert.equal(equalBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2])), false);
});

test("starter payload encoder exposes the Synapse minimum", () => {
  assert.equal(MIN_UPLOAD_BYTES, 127);
  assert.deepEqual(toPayloadBytes("FOC"), new TextEncoder().encode("FOC"));
});
