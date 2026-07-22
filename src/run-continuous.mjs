import { pathToFileURL } from "node:url";
import path from "node:path";
import { CONFIG, main as checkOnce } from "./monitor.mjs";

const SECOND = 1_000;
const MINUTE = 60 * SECOND;

export function calculateDeadline(startedAt, monitorUntil, maxRunMs) {
  return Math.min(startedAt + maxRunMs, new Date(monitorUntil).getTime());
}

export function calculateDelay(cycleStartedAt, currentTime, intervalMs, deadline) {
  return Math.max(0, Math.min(cycleStartedAt + intervalMs, deadline) - currentTime);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runContinuous({
  check = checkOnce,
  now = () => Date.now(),
  wait = sleep,
  intervalMs = Number(process.env.CHECK_INTERVAL_SECONDS || 60) * SECOND,
  maxRunMs = Number(process.env.CONTINUOUS_RUN_MINUTES || 330) * MINUTE,
  maxConsecutiveFailures = Number(process.env.MAX_CONSECUTIVE_FAILURES || 5),
  monitorUntil = CONFIG.monitorUntil,
} = {}) {
  const startedAt = now();
  const deadline = calculateDeadline(startedAt, monitorUntil, maxRunMs);
  let consecutiveFailures = 0;
  let checks = 0;

  if (!Number.isFinite(deadline) || deadline <= startedAt) {
    console.log(`감시 종료 시각이 지났습니다: ${monitorUntil}`);
    return { checks, consecutiveFailures };
  }

  console.log(
    `연속 감시를 시작합니다. 간격 ${Math.round(intervalMs / SECOND)}초, 이번 작업 종료 ${new Date(deadline).toISOString()}`,
  );

  while (now() < deadline) {
    const cycleStartedAt = now();
    checks += 1;

    try {
      await check();
      consecutiveFailures = 0;
    } catch (error) {
      consecutiveFailures += 1;
      console.error(
        `확인 실패 (${consecutiveFailures}/${maxConsecutiveFailures}):`,
        error?.stack || error,
      );
      if (consecutiveFailures >= maxConsecutiveFailures) {
        throw new Error(`Q-Net 확인이 ${maxConsecutiveFailures}회 연속 실패했습니다.`);
      }
    }

    const currentTime = now();
    if (currentTime >= deadline) break;
    await wait(calculateDelay(cycleStartedAt, currentTime, intervalMs, deadline));
  }

  console.log(`이번 연속 감시 작업을 마칩니다. 총 ${checks}회 확인했습니다.`);
  return { checks, consecutiveFailures };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runContinuous().catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
