import test from "node:test";
import assert from "node:assert/strict";
import { configuredCities } from "../src/multi-city-monitor.mjs";

test("아산과 천안 등 여러 도시 설정을 정리한다", () => {
  assert.deepEqual(configuredCities("아산시, 천안시,아산시"), ["아산시", "천안시"]);
});
