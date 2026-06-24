// // ============================================================
// // dom-compressor.ts
// // Strips the raw SPAPageData down to only what the LLM needs,
// // cutting token usage by ~70-80% (see earlier token-cost discussion)
// // ======================================================
// import { SPAPageData } from "../page_analyzer/spa-page-analyzer.service";

// export interface CompressedElement {
//   selector: string;
//   label: string;
// }

// export interface CompressedDOM {
//   url: string;
//   title: string;
//   inputs: CompressedElement[];
//   buttons: CompressedElement[];
//   navLinks: { text: string; href: string }[];
//   //   headings: { tag: string; text: string }[];
// }

// /**
//  * Picks the single most stable selector for an element,
//  * preferring test-specific attributes over fragile CSS paths.
//  */
// export function pickBestSelector(selectors: {
//   dataTestId?: string | null;
//   dataCy?: string | null;
//   dataTest?: string | null;
//   id?: string | null;
//   ariaLabel?: string | null;
//   name?: string | null;
//   css?: string;
// }): string {
//   if (selectors.dataTestId) return `[data-testid="${selectors.dataTestId}"]`;
//   if (selectors.dataCy) return `[data-cy="${selectors.dataCy}"]`;
//   if (selectors.dataTest) return `[data-test="${selectors.dataTest}"]`;
//   if (selectors.id) return `#${selectors.id}`;
//   if (selectors.ariaLabel) return `[aria-label="${selectors.ariaLabel}"]`;
//   if (selectors.name) return `[name="${selectors.name}"]`;
//   return selectors.css ?? "";
// }

// export function compressDOMForAI(pageData: SPAPageData): CompressedDOM {
//   return {
//     url: pageData.url,
//     title: pageData.title,

//     inputs: pageData.inputs.map((i) => ({
//       selector: pickBestSelector({ css: i.selector }),
//       label:
//         i.label ?? i.placeholder ?? i.ariaLabel ?? i.name ?? "unlabeled input",
//     })),

//     buttons: pageData.buttons.map((b) => ({
//       selector: pickBestSelector({ css: b.selector }),
//       label: (b.text ?? b.ariaLabel ?? "unlabeled button").slice(0, 40),
//     })),

//     // Only top nav-relevant links — full link list is rarely needed
//     navLinks: pageData.links
//       .filter((l) => l.text && l.href)
//       .slice(0, 10)
//       .map((l) => ({
//         text: (l.text ?? "").slice(0, 30),
//         href: l.href ?? "",
//       })),

//     // h1/h2 only — page sections, not every heading
//   };
// }
