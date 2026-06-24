// import { SPAFramework } from "../../../types/ai.types";
// import { ElementInfo } from "../../../types/ai.types";
// import { ButtonInfo } from "../../../types/ai.types";
// import { LinkInfo } from "../../../types/ai.types";
// import { FormInfo } from "../../../types/ai.types";
// import { DiscoveredPanel } from "../../../types/ai.types";
// import { RouteInfo } from "../../../types/ai.types";
// import { NetworkRequest } from "../../../types/ai.types";
// import { InputInfo } from "../../../types/ai.types";
// import { chromium } from "playwright";
// import { Page } from "playwright";
// import { discoverInteractivePanels } from "../page_analyzer/page-analyzer.service";
// import { detectFramework } from "../page_analyzer/page-analyzer.service";
// import { waitForSPAReady } from "../page_analyzer/page-analyzer.service";
// import { discoverScrollContent } from "../page_analyzer/page-analyzer.service";
// import { discoverSPARoutes } from "../page_analyzer/page-analyzer.service";
// import { extractPageElements } from "../page_analyzer/page-analyzer.service";
// export interface SPAPageData {
//   // Standard fields (your existing structure)
//   url: string;
//   title: string;
//   inputs: InputInfo[];
//   buttons: ButtonInfo[];
//   links: LinkInfo[];
//   forms: FormInfo[];

//   // New SPA-specific fields
//   framework: SPAFramework;
//   isSPA: boolean;

//   // Elements revealed by scrolling
//   lazyLoadedElements: ElementInfo[];

//   // Elements revealed by interaction
//   interactivePanels: DiscoveredPanel[];

//   // Other routes discovered
//   discoveredRoutes: RouteInfo[];

//   // API calls the page makes (useful for assertion planning)
//   networkRequests: NetworkRequest[];

//   // Client-side routing info
//   routerType: "hash" | "history" | "memory" | null;
// }

// export async function analyzePageDeep(url: string): Promise<SPAPageData> {
//   const browser = await chromium.launch({ headless: true });
//   const page = await browser.newPage();
//   // ... setup ...

//   // Run all phases
//   await page.goto(url, { waitUntil: "domcontentloaded" });
//   const framework = await detectFramework(page);
//   await waitForSPAReady(page, framework);

//   await discoverScrollContent(page); // Phase 2
//   const panels = await discoverInteractivePanels(page); // Phase 3
//   const routes = await discoverSPARoutes(page, url); // Phase 4

//   // Final extraction with everything revealed
//   const elements = await extractPageElements(page);

//   return {
//     ...elements,

//     framework,
//     isSPA: framework !== "unknown",
//     interactivePanels: panels,
//     discoveredRoutes: routes,
//     networkRequests: [],
//     lazyLoadedElements: [],
//     routerType: null,
//   };
// }
