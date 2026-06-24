// // backend/src/module/ai_layer/page-analyzer.service.ts
// import { Page } from "playwright";
// import { chromium } from "playwright";
// import { SPAPageData } from "../page_analyzer/spa-page-analyzer.service";
// import type { DiscoveredPanel } from "../../../types/ai.types";
// import { NetworkRequest } from "../../../types/ai.types";
// import { SPAFramework } from "../../../types/ai.types";
// import { RouteInfo } from "../../../types/ai.types";
// import { ElementInfo } from "../../../types/ai.types";
// export async function analyzeSPA(url: string): Promise<SPAPageData> {
//   const browser = await chromium.launch({ headless: true });
//   const context = await browser.newContext({
//     viewport: { width: 1280, height: 720 },
//     userAgent: "Mozilla/5.0 (compatible; TestBot/1.0)",
//   });
//   const page = await context.newPage();

//   // Intercept network------------------------------------ — we want to know what APIs the page calls
//   const networkRequests: NetworkRequest[] = [];
//   page.on("request", (req) => {
//     if (req.resourceType() === "fetch" || req.resourceType() === "xhr") {
//       networkRequests.push({ url: req.url(), method: req.method() });
//     }
//   });

//   await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

//   // Detect which framework is running
//   const framework = await detectFramework(page);

//   // Wait strategy depends on framework
//   await waitForSPAReady(page, framework);

//   // ... rest of analysis
//   const pageData = await extractPageElements(page);
//   // Discover additional SPA content
//   await discoverScrollContent(page);

//   const interactivePanels = await discoverInteractivePanels(page);

//   const discoveredRoutes = await discoverSPARoutes(page, url);

//   // TODO: implement actual router detection
//   const routerType: "hash" | "history" | "memory" | null = null;

//   // TODO: populate real lazy-loaded elements
//   const lazyLoadedElements: ElementInfo[] = [];

//   return {
//     url: pageData.url,
//     title: pageData.title,

//     inputs: pageData.inputs,
//     buttons: pageData.buttons,
//     links: pageData.links,
//     forms: pageData.forms,
//     framework,
//     interactivePanels,
//     discoveredRoutes,
//     routerType,
//     lazyLoadedElements,
//     isSPA: framework !== "unknown",
//     networkRequests,
//   };
// }

// export async function detectFramework(page: Page): Promise<SPAFramework> {
//   return await page.evaluate(() => {
//     if ((window as any).__NEXT_DATA__) return "next";
//     if ((window as any).__nuxt__) return "nuxt";
//     if ((window as any).angular) return "angular";
//     if (document.querySelector("[data-reactroot], #root, #app")) {
//       // Could be React or Vue — check further
//       if ((window as any).__VUE__) return "vue";
//       return "react";
//     }
//     // if ((window as any).Ember) return "ember";
//     return "unknown";
//   });
// }

// export async function waitForSPAReady(page: Page, framework: SPAFramework) {
//   switch (framework) {
//     case "next":
//       // Wait for Next.js router to be ready
//       await page
//         .waitForFunction(
//           () => (window as any).__NEXT_DATA__?.props !== undefined,
//           { timeout: 10000 },
//         )
//         .catch(() => {});
//       break;

//     case "react":
//     case "vue":
//       // Wait for hydration — no pending state updates
//       await page
//         .waitForFunction(
//           () => {
//             const root = document.querySelector(
//               "#root, #app, [data-reactroot]",
//             );
//             return root && root.children.length > 0;
//           },
//           { timeout: 10000 },
//         )
//         .catch(() => {});
//       break;

//     default:
//       await page
//         .waitForLoadState("networkidle", { timeout: 15000 })
//         .catch(() => {});
//   }

//   // Always do a small extra wait after framework-specific check
//   await page.waitForTimeout(800);
// }
// /* ..............................................*/
// export async function discoverScrollContent(page: Page): Promise<void> {
//   const viewportHeight = page.viewportSize()?.height ?? 720;

//   // Get full page height
//   const pageHeight = await page.evaluate(() => document.body.scrollHeight);

//   let currentScroll = 0;
//   const scrollStep = viewportHeight * 0.8; // 80% overlap for safety

//   while (currentScroll < pageHeight) {
//     await page.evaluate((y) => window.scrollTo(0, y), currentScroll);

//     // Wait for lazy-loaded content to appear
//     // IntersectionObserver-based components fire here
//     await page.waitForTimeout(600);

//     // Wait for any new network requests triggered by scroll to complete
//     await page
//       .waitForLoadState("networkidle", { timeout: 3000 })
//       .catch(() => {});

//     currentScroll += scrollStep;
//   }

//   // Scroll back to top — important so AI sees the page in natural state
//   await page.evaluate(() => window.scrollTo(0, 0));
//   await page.waitForTimeout(400);
// }

// /*.............................................................*/
// // interface DiscoveredPanel {
// //   trigger: ElementInfo; // The element that opens it
// //   triggerType: "tab" | "accordion" | "dropdown" | "modal-trigger";
// //   revealedElements: ElementInfo[]; // What appeared after clicking
// //   url: string; // URL after trigger (may change for tab routing)
// // }
// export async function extractNewElements(page: Page): Promise<ElementInfo[]> {
//   return page.evaluate(() => {
//     return Array.from(
//       document.querySelectorAll("input, button, select, textarea, a"),
//     ).map((el) => {
//       const htmlEl = el as HTMLElement;

//       return {
//         tag: el.tagName.toLowerCase(),

//         selector: htmlEl.id ? `#${htmlEl.id}` : "",

//         text: htmlEl.textContent?.trim(),

//         id: htmlEl.id || undefined,

//         className: htmlEl.className || undefined,

//         role: htmlEl.getAttribute("role") || undefined,

//         visible: !!(
//           htmlEl.offsetWidth ||
//           htmlEl.offsetHeight ||
//           htmlEl.getClientRects().length
//         ),

//         enabled: !htmlEl.hasAttribute("disabled"),
//       };
//     });
//   });
// }
// export async function discoverInteractivePanels(
//   page: Page,
// ): Promise<DiscoveredPanel[]> {
//   const discovered: DiscoveredPanel[] = [];

//   // Find likely tab/accordion/dropdown triggers
//   const triggers = await page.evaluate(() => {
//     const candidates: any[] = [];

//     // ARIA roles that indicate interactive disclosure
//     const ariaSelectors = [
//       '[role="tab"]',
//       '[role="button"][aria-expanded]',
//       "[aria-controls]",
//       "[data-toggle]",
//       '[data-bs-toggle="tab"], [data-bs-toggle="collapse"]', // Bootstrap
//     ];

//     ariaSelectors.forEach((sel) => {
//       document.querySelectorAll(sel).forEach((el) => {
//         const htmlEl = el as HTMLElement;
//         candidates.push({
//           selector: el.id ? `#${el.id}` : null,
//           ariaControls: el.getAttribute("aria-controls"),
//           text: htmlEl.textContent?.trim().slice(0, 50),
//           role: el.getAttribute("role"),
//           tagName: el.tagName.toLowerCase(),
//         });
//       });
//     });

//     return candidates.slice(0, 20); // Cap at 20 to avoid infinite loops
//   });

//   for (const trigger of triggers) {
//     if (!trigger.selector && !trigger.ariaControls) continue;

//     try {
//       // Snapshot DOM before clicking
//       const beforeElements = await countInteractiveElements(page);
//       const beforeUrl = page.url();

//       // Click the trigger
//       const selector =
//         trigger.selector ?? `[aria-controls="${trigger.ariaControls}"]`;
//       await page.click(selector, { timeout: 3000 });
//       await page.waitForTimeout(600);
//       await page
//         .waitForLoadState("networkidle", { timeout: 3000 })
//         .catch(() => {});

//       // Snapshot DOM after clicking
//       const afterElements = await countInteractiveElements(page);
//       const afterUrl = page.url();

//       // If new elements appeared OR URL changed → this trigger revealed content
//       if (afterElements > beforeElements || afterUrl !== beforeUrl) {
//         const revealedElements = await extractNewElements(page);
//         discovered.push({
//           trigger: { selector, text: trigger.text, role: trigger.role },
//           triggerType: trigger.role === "tab" ? "tab" : "accordion",
//           revealedElements,
//           url: afterUrl,
//         });
//       }

//       // Close/undo the trigger if possible (click again or press Escape)
//       await page.keyboard.press("Escape").catch(() => {});

//       // If URL changed, navigate back
//       if (afterUrl !== beforeUrl) {
//         await page.goBack().catch(() => {});
//         await waitForSPAReady(page, "unknown");
//       }
//     } catch (e) {
//       // Trigger failed — skip silently
//       continue;
//     }
//   }

//   return discovered;
// }

// export async function countInteractiveElements(page: Page): Promise<number> {
//   return page.evaluate(
//     () =>
//       document.querySelectorAll(
//         'input, button, select, textarea, [role="button"]',
//       ).length,
//   );
// }
// export async function extractPageElements(page: Page) {
//   const data = await page.evaluate(() => {
//     const inputs = Array.from(document.querySelectorAll("input")).map((el) => ({
//       selector: el.id ? `#${el.id}` : "",
//       tag: "input",
//       type: el.type,
//       name: el.name,
//       placeholder: el.placeholder,
//       visible: true,
//     }));

//     const buttons = Array.from(document.querySelectorAll("button")).map(
//       (el) => ({
//         selector: el.id ? `#${el.id}` : "",
//         tag: "button",
//         text: el.textContent?.trim() ?? "",
//         visible: true,
//       }),
//     );

//     const links = Array.from(document.querySelectorAll("a")).map((el) => ({
//       selector: "",
//       tag: "a",
//       text: el.textContent?.trim() ?? "",
//       href: el.href,
//       visible: true,
//     }));

//     const forms = Array.from(document.querySelectorAll("form")).map((el) => ({
//       selector: "",
//       action: el.action,
//       method: el.method,
//       inputs: [],
//       buttons: [],
//     }));

//     return {
//       url: location.href,
//       title: document.title,
//       inputs,
//       buttons,
//       links,
//       forms,
//     };
//   });

//   return data;
// }
// /**............................................. */
// export async function discoverSPARoutes(
//   page: Page,
//   baseUrl: string,
// ): Promise<RouteInfo[]> {
//   const routes: RouteInfo[] = [];
//   const visited = new Set<string>([page.url()]);

//   // Strategy 1: Extract from framework router
//   const routerRoutes = await page.evaluate(() => {
//     // Next.js exposes routes
//     if ((window as any).__NEXT_DATA__?.page) {
//       return [(window as any).__NEXT_DATA__.page];
//     }
//     // React Router sometimes exposes history
//     if ((window as any).__reactRouterHistory) {
//       return [];
//     }
//     return [];
//   });

//   // Strategy 2: Extract all internal <a> href links
//   const linkRoutes = await page.evaluate((base) => {
//     return Array.from(document.querySelectorAll("a[href]"))
//       .map((a) => a.getAttribute("href"))
//       .filter((href) => href && (href.startsWith("/") || href.startsWith(base)))
//       .filter((href) => !href!.includes("#")) // skip hash links
//       .slice(0, 30); // cap exploration
//   }, baseUrl);

//   const allRoutes = [...new Set([...routerRoutes, ...linkRoutes])];

//   // Visit each route and extract its DOM
//   for (const route of allRoutes.slice(0, 10)) {
//     // max 10 routes
//     const fullUrl = route.startsWith("/")
//       ? `${new URL(baseUrl).origin}${route}`
//       : route;

//     if (visited.has(fullUrl)) continue;
//     visited.add(fullUrl);

//     try {
//       await page.goto(fullUrl, {
//         waitUntil: "domcontentloaded",
//         timeout: 15000,
//       });
//       await waitForSPAReady(page, "unknown");

//       const routeData = await extractPageElements(page);

//       routes.push({
//         url: fullUrl,
//         path: route,

//         title: routeData.title,
//         routeType: "link",

//         elements: {
//           inputs: routeData.inputs,
//           buttons: routeData.buttons,
//           links: routeData.links,
//           forms: routeData.forms,
//         },
//       });
//     } catch (e) {
//       continue;
//     }
//   }

//   return routes;
// }
