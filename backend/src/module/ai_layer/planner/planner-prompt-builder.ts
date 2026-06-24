// import { SPAPageData } from "../page_analyzer/spa-page-analyzer.service";
// import { InputInfo, ButtonInfo } from "../../../types/ai.types";
// export function buildSPAAwarePlannerPrompt(
//   pageData: SPAPageData,
//   userPrompt: string,
// ): string {
//   const elements: (InputInfo | ButtonInfo)[] = [
//     ...pageData.inputs,
//     ...pageData.buttons,
//   ];
//   return `
// TARGET: ${pageData.url} (${pageData.framework} SPA)
// INITIAL PAGE ELEMENTS:
// ${JSON.stringify(elements, null, 2)}
// CONTENT REVEALED BY INTERACTION:
// ${pageData.interactivePanels
//   .map(
//     (p: any) =>
//       `Clicking "${p.trigger.text}" reveals: ${JSON.stringify(p.revealedElements)}`,
//   )
//   .join("\n")}

// OTHER ROUTES AVAILABLE:
// ${pageData.discoveredRoutes.map((r: any) => `${r.path}: ${r.elements.title}`).join("\n")}

// IMPORTANT: This is a SPA. Page transitions happen WITHOUT full page reloads.
// After clicking navigation links, wait for network idle before interacting.
// Use waitForSelector before any interaction on a new route.

// USER GOAL: ${userPrompt}
//   `;
// }
