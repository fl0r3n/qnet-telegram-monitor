import path from "node:path";
import { pathToFileURL } from "node:url";
import { runContinuous } from "./run-continuous.mjs";
import { checkAllCities } from "./multi-city-monitor.mjs";

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runContinuous({ check: checkAllCities }).catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
