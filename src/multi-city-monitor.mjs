import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function configuredCities(value = process.env.CITIES || "아산시,천안시") {
  return [...new Set(value.split(",").map((city) => city.trim()).filter(Boolean))];
}

function runCity(city, index) {
  const stateDir = process.env.MULTI_CITY_STATE_DIR || path.resolve(".state");
  const child = spawn(process.execPath, [path.resolve("src/monitor.mjs")], {
    stdio: "inherit",
    env: {
      ...process.env,
      CITY: city,
      STATE_PATH: path.join(stateDir, `qnet-state-city-${index + 1}.json`),
    },
  });

  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${city} 확인 프로세스 실패: code=${code}, signal=${signal || "none"}`));
    });
  });
}

export async function checkAllCities(cities = configuredCities()) {
  for (const [index, city] of cities.entries()) {
    console.log(`지역 확인 시작: 충청남도 ${city}`);
    await runCity(city, index);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  checkAllCities().catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
