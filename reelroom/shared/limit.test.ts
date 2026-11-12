import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tooMany } from "./limit.ts";

describe("tooMany", () => {
  it("allows a burst and then refuses", () => {
    const key = `burst-${Date.now()}`;
    assert.equal(tooMany(key, 2, 1000, 0), false);
    assert.equal(tooMany(key, 2, 1000, 10), false);
    assert.equal(tooMany(key, 2, 1000, 20), true);
    assert.equal(tooMany(key, 2, 1000, 2000), false);
  });
});
