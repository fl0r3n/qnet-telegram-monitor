import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateDeadline,
  calculateDelay,
  runContinuous,
} from "../src/run-continuous.mjs";

test("연속 감시 종료 시각은 작업 한도와 전체 감시 종료 중 빠른 쪽이다", () => {
  const startedAt = Date.parse("2026-07-23T00:00:00Z");
  assert.equal(
    calculateDeadline(startedAt, "2026-07-23T10:00:00Z", 330 * 60_000),
    startedAt + 330 * 60_000,
  );
  assert.equal(
    calculateDeadline(startedAt, "2026-07-23T01:00:00Z", 330 * 60_000),
    Date.parse("2026-07-23T01:00:00Z"),
  );
});

test("확인 시작 시각 기준으로 다음 확인까지 남은 시간만 기다린다", () => {
  assert.equal(calculateDelay(1_000, 11_000, 60_000, 1_000_000), 50_000);
  assert.equal(calculateDelay(1_000, 71_000, 60_000, 1_000_000), 0);
});

test("일시적인 실패 후에도 연속 감시를 계속한다", async () => {
  let currentTime = 0;
  let attempts = 0;
  const result = await runContinuous({
    check: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("temporary");
    },
    now: () => currentTime,
    wait: async (ms) => {
      currentTime += ms;
    },
    intervalMs: 1_000,
    maxRunMs: 2_500,
    maxConsecutiveFailures: 3,
    monitorUntil: "2100-01-01T00:00:00Z",
  });

  assert.equal(result.checks, 3);
  assert.equal(result.consecutiveFailures, 0);
});
