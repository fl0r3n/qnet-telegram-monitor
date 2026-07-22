import test from "node:test";
import assert from "node:assert/strict";
import {
  availabilityKey,
  availableRowsFromCells,
  buildTelegramMessage,
} from "../src/monitor.mjs";

test("마감·빈 결과를 제외하고 접수 가능 행만 남긴다", () => {
  const rows = [
    ["시험장 A", "2026-08-01", "09:00", "마감"],
    ["시험장 B", "2026-08-01", "12:30", "3명"],
    ["데이터가 존재하지 않습니다"],
  ];

  assert.deepEqual(availableRowsFromCells(rows), [
    ["시험장 B", "2026-08-01", "12:30", "3명"],
  ]);
});

test("동일한 행은 동일한 중복 방지 키를 만든다", () => {
  const rows = [["시험장 B", "3명"]];
  assert.equal(availabilityKey(rows), availabilityKey(rows));
  assert.equal(availabilityKey([]), "");
});

test("텔레그램 메시지에 접수 URL과 시험장 정보를 넣는다", () => {
  const message = buildTelegramMessage([["시험장 B", "3명"]]);
  assert.match(message, /시험장 B/);
  assert.match(message, /Q-Net 원서접수 페이지 열기/);
  assert.match(message, /rcv202\.do/);
});
