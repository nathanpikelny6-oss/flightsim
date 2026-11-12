import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FORMATS, PlanError, adoptPlan, planReel } from "./plan.ts";
import { MODELS } from "./models.ts";
import { allowedVideoUrl, plainTaskId, veoOperation } from "./guards.ts";

describe("planReel", () => {
  it("builds a shot list for every format", () => {
    for (const format of FORMATS) {
      const plan = planReel({
        prompt: format.example,
        formatId: format.id,
        duration: 8,
        aspect: "9:16",
        edit: "punch",
      });
      assert.equal(plan.formatId, format.id);
      assert.ok(plan.shots.length >= 4);
      for (const shot of plan.shots) {
        assert.ok(shot.line.length > 0);
        assert.ok(shot.line.length <= 48);
        assert.ok(shot.detail.length > 0);
      }
      assert.ok(plan.hashtags.length > 0);
      assert.ok(plan.hashtags.every((tag) => /^[a-z0-9]+$/.test(tag)));
      if (format.id === "hotel-lobby") assert.match(plan.videoPrompt, /orange room/i);
    }
  });

  it("clamps duration and falls back to a known format", () => {
    const plan = planReel({
      prompt: "a quiet Sunday reset",
      formatId: "nope",
      duration: 100,
      aspect: "square",
      edit: "nope",
    });
    assert.equal(plan.duration, 10);
    assert.equal(plan.aspect, "9:16");
    assert.equal(plan.formatId, "result-first");
    assert.equal(plan.edit, "punch");
  });

  it("refuses an empty prompt and a blocked prompt", () => {
    assert.throws(() => planReel({ prompt: "  ", formatId: "result-first", duration: 6, aspect: "9:16", edit: "fast" }), PlanError);
    assert.throws(
      () => planReel({ prompt: "nude child", formatId: "say-this", duration: 6, aspect: "9:16", edit: "fast" }),
      PlanError,
    );
  });

  it("keeps local timing when a rewrite is thin", () => {
    const local = planReel({
      prompt: "desk lunch that is not a sad salad",
      formatId: "save-chart",
      duration: 6,
      aspect: "1:1",
      edit: "fast",
    });
    assert.equal(adoptPlan(local, { shots: [{ line: "only one" }] }), local);
    const merged = adoptPlan(local, {
      title: "Desk lunch",
      hook: "Save the lunch grid",
      caption: "Four lunches, no speech.",
      hashtags: ["Desk Lunch", "food"],
      shots: [
        { kicker: "Save", line: "Four lunches", detail: "No speech." },
        { kicker: "One", line: "Eggs and rice", detail: "Salt at the end." },
        { kicker: "Two", line: "Toast and beans", detail: "Use what is open." },
      ],
    });
    assert.equal(merged.duration, local.duration);
    assert.equal(merged.aspect, "1:1");
    assert.equal(merged.shots[0]?.line, "Four lunches");
    assert.deepEqual(merged.hashtags, ["desklunch", "food"]);
  });
});

describe("guards", () => {
  it("accepts a real Veo operation and rejects a path trick", () => {
    const id = "models/veo-3.1-generate-preview/operations/abc_def-123456";
    assert.equal(veoOperation(id), id);
    assert.equal(veoOperation("models/../operations/abcdef"), null);
    assert.equal(veoOperation("https://generativelanguage.googleapis.com/v1beta/files/x"), null);
    assert.equal(plainTaskId("cgt-task-123456"), "cgt-task-123456");
    assert.equal(plainTaskId("../etc/passwd"), null);
  });

  it("allowlists video hosts", () => {
    assert.ok(allowedVideoUrl("https://dashscope-result.oss-cn-beijing.aliyuncs.com/a.mp4?sig=1"));
    assert.equal(allowedVideoUrl("http://generativelanguage.googleapis.com/v1beta/files/a"), null);
    assert.equal(allowedVideoUrl("https://169.254.169.254/latest/meta-data"), null);
    assert.equal(allowedVideoUrl("https://user:pass@aliyuncs.com/a.mp4"), null);
  });

  it("gives every model a unique id", () => {
    const ids = MODELS.map((model) => model.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const model of MODELS) {
      if (model.access === "key") assert.ok(model.provider && model.providerModel);
      if (model.access !== "key") assert.equal(model.provider, undefined);
    }
  });
});
