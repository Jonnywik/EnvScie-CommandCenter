import { firefox, webkit } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";

const baseUrl = "http://127.0.0.1:3100/";
const viewports = [768, 900, 1024];
const tabs = [
  { id: "command-map", title: "Command Map" },
  { id: "incidents", title: "Incidents" },
  { id: "field-response", title: "Field Response" },
  { id: "community-safety", title: "Community Safety" },
  { id: "intelligence", title: "Intelligence" },
];
const engines = [
  { id: "firefox", launcher: firefox },
  { id: "webkit", launcher: webkit },
];
const outputDir = "/home/ubuntu/browser-audit";
const results = { generatedAt: new Date().toISOString(), engines: {} };

await mkdir(outputDir, { recursive: true });

for (const engine of engines) {
  const browser = await engine.launcher.launch({ headless: true });
  const engineResult = { viewports: {}, accessibility: {} };

  for (const width of viewports) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const viewportResult = {};

    for (const tab of tabs) {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await page.locator(`button[title="${tab.title}"]`).click();
      await page.waitForTimeout(250);
      viewportResult[tab.id] = await page.evaluate(() => {
        const rect = (element) => {
          if (!element) return null;
          const bounds = element.getBoundingClientRect();
          return { left: Math.round(bounds.left), top: Math.round(bounds.top), width: Math.round(bounds.width), height: Math.round(bounds.height) };
        };
        const header = document.querySelector(".command-center-header, .dashboard-shell > .topbar");
        const sidebar = document.querySelector(".unified-command-sidebar");
        const emblem = document.querySelector(".command-map-brand img, .command-center-header-brand img, .dashboard-shell > .topbar .brand-mark");
        const style = emblem ? getComputedStyle(emblem) : null;
        const headerBox = rect(header);
        const sidebarBox = rect(sidebar);
        const emblemBox = rect(emblem);
        const overflowing = [...document.querySelectorAll("body *")]
          .map((element) => {
            const bounds = element.getBoundingClientRect();
            const elementStyle = getComputedStyle(element);
            return {
              selector: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${[...element.classList].slice(0, 3).map((className) => `.${className}`).join("")}`,
              left: Math.round(bounds.left),
              right: Math.round(bounds.right),
              width: Math.round(bounds.width),
              overflowX: elementStyle.overflowX,
              whiteSpace: elementStyle.whiteSpace,
            };
          })
          .filter((item) => item.width > 0 && (item.left < -1 || item.right > window.innerWidth + 1))
          .slice(0, 12);
        const scrollSources = [...document.querySelectorAll("body *")]
          .map((element) => {
            const elementStyle = getComputedStyle(element);
            return {
              selector: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${[...element.classList].slice(0, 3).map((className) => `.${className}`).join("")}`,
              clientWidth: element.clientWidth,
              scrollWidth: element.scrollWidth,
              overflowX: elementStyle.overflowX,
            };
          })
          .filter((item) => item.scrollWidth > item.clientWidth + 1 && !["auto", "scroll", "hidden", "clip"].includes(item.overflowX))
          .slice(0, 12);
        return {
          documentOverflow: document.documentElement.scrollWidth > window.innerWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
          header: headerBox,
          sidebar: sidebarBox,
          sidebarScroll: sidebar ? { clientWidth: sidebar.clientWidth, scrollWidth: sidebar.scrollWidth, overflowX: getComputedStyle(sidebar).overflowX } : null,
          emblem: emblemBox && style ? { ...emblemBox, borderRadius: style.borderRadius, objectFit: style.objectFit, backgroundColor: style.backgroundColor } : null,
          headerPrecedesSidebar: Boolean(headerBox && sidebarBox && headerBox.top <= sidebarBox.top && headerBox.width >= window.innerWidth),
          overflowing,
          scrollSources,
        };
      });
      if (width === 1024) await page.screenshot({ path: `${outputDir}/${engine.id}-${tab.id}-1024.png`, fullPage: false });
    }

    engineResult.viewports[String(width)] = viewportResult;
    await context.close();
  }

  const accessibilityContext = await browser.newContext({ viewport: { width: 1024, height: 900 }, deviceScaleFactor: 1 });
  const accessibilityPage = await accessibilityContext.newPage();
  for (const tab of tabs) {
    await accessibilityPage.goto(baseUrl, { waitUntil: "networkidle" });
    await accessibilityPage.locator(`button[title="${tab.title}"]`).click();
    await accessibilityPage.waitForTimeout(200);
    const scan = await new AxeBuilder({ page: accessibilityPage })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .include("header")
      .include(".unified-command-sidebar")
      .analyze();
    engineResult.accessibility[tab.id] = scan.violations.map((violation) => ({ id: violation.id, impact: violation.impact, help: violation.help, nodes: violation.nodes.length }));
  }
  await accessibilityContext.close();
  await browser.close();
  results.engines[engine.id] = engineResult;
}

await writeFile("/home/ubuntu/browser_audit_results.json", `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
