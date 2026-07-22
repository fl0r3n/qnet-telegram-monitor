import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const CONFIG = {
  statusUrl: "https://q-net.or.kr/rcv003.do?gId=&gSite=Q&id=rcv00301",
  applicationUrl: "https://q-net.or.kr/rcv202.do?id=rcv20210&gSite=Q&gId=",
  examName: process.env.EXAM_NAME || "2026년 정기 기사 3회 필기",
  subjectValue: process.env.SUBJECT_VALUE || "114",
  subjectName: process.env.SUBJECT_NAME || "정보처리기사",
  province: process.env.PROVINCE || "충청남도",
  city: process.env.CITY || "아산시",
  applicantTypeValue: process.env.APPLICANT_TYPE_VALUE || "01",
  monitorUntil: process.env.MONITOR_UNTIL || "2026-07-23T18:00:00+09:00",
  statePath: process.env.STATE_PATH || path.resolve(".state/qnet-state.json"),
};

function normalize(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function availableRowsFromCells(rows) {
  return rows
    .map((cells) => cells.map(normalize))
    .filter((cells) => cells.length > 1)
    .filter((cells) => !cells.join(" ").includes("데이터가 존재하지 않습니다"))
    .filter((cells) => {
      const status = cells.at(-1) || "";
      if (status.includes("마감")) return false;
      const count = status.match(/\d+/)?.[0];
      return count ? Number(count) > 0 : /접수\s*가능/.test(status);
    });
}

export function availabilityKey(rows) {
  if (!rows.length) return "";
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function buildTelegramMessage(rows, config = CONFIG) {
  const details = rows
    .map((cells, index) => `${index + 1}. ${cells.map(escapeHtml).join(" | ")}`)
    .join("\n");

  return [
    "🚨 <b>정보처리기사 빈자리 발견</b>",
    "",
    `<b>지역:</b> ${escapeHtml(config.province)} ${escapeHtml(config.city)}`,
    `<b>시험:</b> ${escapeHtml(config.examName)}`,
    `<b>종목:</b> ${escapeHtml(config.subjectName)}`,
    "",
    details,
    "",
    `👉 <a href=\"${config.applicationUrl}\">Q-Net 원서접수 페이지 열기</a>`,
    `🔎 <a href=\"${config.statusUrl}\">접수 현황 다시 확인하기</a>`,
    "",
    "빈자리는 빠르게 마감될 수 있으니 Q-Net에서 즉시 확인하세요.",
  ].join("\n");
}

async function loadState(statePath) {
  try {
    return JSON.parse(await readFile(statePath, "utf8"));
  } catch {
    return { lastAvailableKey: "", lastCheckedAt: null };
  }
}

async function saveState(statePath, state) {
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function clickAndSettle(page, locator, delay = 800) {
  await locator.click();
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(delay);
}

async function queryAvailableRows(page, config = CONFIG) {
  await page.goto(config.statusUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

  const targetRow = page.locator("tr", { hasText: config.examName });
  if (await targetRow.count() !== 1) {
    throw new Error(`시험 회차를 찾지 못했습니다: ${config.examName}`);
  }
  await clickAndSettle(page, targetRow.getByRole("link", { name: "현황보기", exact: true }));

  await page.locator('select[name="JongMook"]').selectOption(config.subjectValue);
  await clickAndSettle(page, page.getByRole("button", { name: "다음", exact: true }));

  await page.locator("select#sido").selectOption({ label: config.province });
  await page.waitForTimeout(800);
  await page.locator("select#sigungu").selectOption({ label: config.city });
  await page.locator("select#recptCd").selectOption(config.applicantTypeValue);
  await page.waitForTimeout(800);
  await page.locator("select#closingView").selectOption("N");
  await clickAndSettle(page, page.getByRole("button", { name: "조회", exact: true }), 1_500);

  const resultTable = page.locator("table").filter({ hasText: "필기 현황 조회 목록" });
  if (await resultTable.count() !== 1) {
    throw new Error("접수 현황 결과표를 찾지 못했습니다.");
  }

  const rawRows = await resultTable.locator("tbody tr").evaluateAll((rows) =>
    rows.map((row) => [...row.children].map((cell) => cell.innerText)),
  );
  return availableRowsFromCells(rawRows);
}

async function sendTelegram(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID가 없습니다.");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`텔레그램 전송 실패 (${response.status}): ${await response.text()}`);
  }
}

export async function main() {
  const now = new Date();
  if (now >= new Date(CONFIG.monitorUntil)) {
    console.log(`감시 종료 시각이 지났습니다: ${CONFIG.monitorUntil}`);
    return;
  }

  const state = await loadState(CONFIG.statePath);
  const browser = await chromium.launch({ headless: true });
  let rows;
  try {
    const page = await browser.newPage({ locale: "ko-KR", timezoneId: "Asia/Seoul" });
    rows = await queryAvailableRows(page);
  } finally {
    await browser.close();
  }

  const currentKey = availabilityKey(rows);
  const shouldNotify = Boolean(currentKey) && currentKey !== state.lastAvailableKey;

  if (shouldNotify) {
    const message = buildTelegramMessage(rows);
    if (process.env.DRY_RUN === "1") {
      console.log(message);
    } else {
      await sendTelegram(message);
      console.log(`텔레그램 알림을 보냈습니다. 빈자리 행: ${rows.length}개`);
    }
  } else {
    console.log(rows.length ? "동일한 빈자리라 중복 알림을 생략했습니다." : "현재 접수 가능한 빈자리가 없습니다.");
  }

  await saveState(CONFIG.statePath, {
    lastAvailableKey: currentKey,
    lastCheckedAt: now.toISOString(),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
