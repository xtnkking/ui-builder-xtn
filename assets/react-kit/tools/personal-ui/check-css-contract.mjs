import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { analyzeCssContract, checkBuiltCss } from "./css-contract-core.mjs";

const kitRoot = process.cwd();
const config = JSON.parse(fs.readFileSync(path.join(kitRoot, "css-contract.json"), "utf8"));
const reportPath = path.join(kitRoot, "etc/personal-ui.css-contract.json");
const write = process.argv.includes("--write");
const dist = process.argv.includes("--dist");

if (dist) {
  const assets = path.join(kitRoot, "dist/assets");
  const cssFiles = fs.existsSync(assets)
    ? fs.readdirSync(assets).filter((file) => file.endsWith(".css")).map((file) => path.join(assets, file))
    : [];
  const componentCss = cssFiles.filter((file) => fs.readFileSync(file, "utf8").includes(".pui-"));
  const errors = componentCss.flatMap((file) => checkBuiltCss(file, config.layerOrder));
  if (componentCss.length === 0) errors.push("dist contains no Personal UI CSS asset");
  if (errors.length > 0) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exit(1);
  }
  console.log(`Built CSS contract valid: ${componentCss.length} asset(s).`);
  process.exit(0);
}

const { errors, report } = analyzeCssContract(kitRoot);
const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (errors.length === 0) {
  if (write) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, serialized);
  } else if (!fs.existsSync(reportPath) || fs.readFileSync(reportPath, "utf8") !== serialized) {
    errors.push("CSS contract report is stale; run npm run css:report");
  }
}
if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log(`CSS contract valid: ${report.files.length} files, ${report.selectorOwners.length} selector owners, ${report.tokens.length} tokens.`);
