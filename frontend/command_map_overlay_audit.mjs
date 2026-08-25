import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const baseUrl = "http://127.0.0.1:3200/";
const viewports = [
  { id: "desktop", width: 1280, height: 900 },
  { id: "tablet", width: 900, height: 900 },
  { id: "narrow", width: 390, height: 844 },
];
const outputDir = "/home/ubuntu/command-map-overlay-audit";
const overlaySelectors = {
  inspector: ".map-pin-sheet",
  layerDrawer: ".command-map-layer-drawer",
  triageDrawer: ".command-map-triage-drawer",
  facilityDrawer: ".official-facility-panel",
  mapControls: ".map-control-dock",
  legend: ".map-legend",
  broadcast: ".broadcast-fab",
};

function rectOf(element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    right: Math.round(rect.right),
    bottom: Math.round(rect.bottom),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function overlap(left, right) {
  return left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top;
}

async function measure(page) {
  return page.evaluate((selectors) => {
    const rectOf = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { left: Math.round(rect.left), top: Math.round(rect.top), right: Math.round(rect.right), bottom: Math.round(rect.bottom), width: Math.round(rect.width), height: Math.round(rect.height), visible: style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0 };
    };
    const overlays = Object.fromEntries(Object.entries(selectors).map(([name, selector]) => [name, rectOf(document.querySelector(selector))]));
    const inspector = document.querySelector(".map-pin-sheet");
    const inspectorChildren = inspector ? [
      ["heading", inspector.querySelector(".map-pin-sheet-heading")],
      ["close", inspector.querySelector(".map-pin-sheet-heading button")],
      ["action", inspector.querySelector(".map-pin-sheet-actions .tiny-button")],
    ].map(([name, element]) => [name, rectOf(element)]) : [];
    return { viewport: { width: window.innerWidth, height: window.innerHeight }, overlays, inspectorChildren };
  }, overlaySelectors);
}

function withinViewport(rect, viewport) {
  return !rect.visible || (rect.left >= 0 && rect.top >= 0 && rect.right <= viewport.width && rect.bottom <= viewport.height);
}

function containmentFailures(snapshot) {
  const failures = [];
  const inspector = snapshot.overlays.inspector;
  if (inspector?.visible) {
    for (const [name, rect] of snapshot.inspectorChildren) {
      if (!rect || rect.left < inspector.left || rect.top < inspector.top || rect.right > inspector.right || rect.bottom > inspector.bottom) failures.push(`Inspector ${name} is outside the inspector boundary.`);
    }
  }
  for (const [name, rect] of Object.entries(snapshot.overlays)) {
    if (rect && !withinViewport(rect, snapshot.viewport)) failures.push(`${name} exceeds the viewport.`);
  }
  const collisionPairs = [
    ["inspector", "layerDrawer"],
    ["inspector", "triageDrawer"],
    ["inspector", "facilityDrawer"],
    ["inspector", "broadcast"],
    ["layerDrawer", "broadcast"],
    ["triageDrawer", "broadcast"],
    ["facilityDrawer", "broadcast"],
  ];
  for (const [leftName, rightName] of collisionPairs) {
    const left = snapshot.overlays[leftName];
    const right = snapshot.overlays[rightName];
    if (left?.visible && right?.visible && overlap(left, right)) failures.push(`${leftName} overlaps ${rightName}.`);
  }
  return failures;
}

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium" });
const results = { generatedAt: new Date().toISOString(), baseUrl, viewports: {} };

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator('[aria-label*="Injury reported; responder team requested"]', { hasText: "" }).first().click();
  await page.waitForTimeout(150);
  const inspector = await measure(page);
  const flows = { inspector };

  const tools = page.getByRole("button", { name: /Map tools/i });
  await tools.click();
  await page.getByRole("button", { name: "Map view", exact: true }).click();
  await page.waitForTimeout(100);
  flows.layerDrawer = await measure(page);

  await tools.click();
  await page.getByRole("button", { name: "Triage", exact: true }).click();
  await page.waitForTimeout(100);
  flows.triageDrawer = await measure(page);

  await tools.click();
  await page.getByRole("button", { name: "Facilities", exact: true }).click();
  await page.waitForTimeout(100);
  flows.facilityDrawer = await measure(page);

  const failures = Object.entries(flows).flatMap(([flow, snapshot]) => containmentFailures(snapshot).map((failure) => `${flow}: ${failure}`));
  results.viewports[viewport.id] = { viewport, flows, failures };
  await page.screenshot({ path: `${outputDir}/${viewport.id}.png`, fullPage: false });
  await context.close();
}

await browser.close();
await writeFile(`${outputDir}/results.json`, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));

if (Object.values(results.viewports).some((entry) => entry.failures.length > 0)) process.exitCode = 1;
