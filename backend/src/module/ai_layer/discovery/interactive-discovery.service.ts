// import { Page } from "playwright";
// interface discoveredPanel {
//   trigger: ElementInfo;
//   triggerType: "tab" | "accordion" | "dropdown" | "modal-trigger";
//   revealedElements: ElementInfo[];
//   url: string;
// }

// export async function discoverInteractivePanels(
//   page: Page,
// ): Promise<discoveredPanel[]> {
//   const discovered: discoveredPanel[] = [];
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
//         const htmlEL = el as HTMLElement;
//         candidates.push({
//           selector: el.id ? `#${el.id}` : null,
//           ariaControls: el.getAttribute("aria-controls"),
//           text: htmlEL.textContent?.trim().slice(0, 50),
//           role: el.getAttribute("role"),
//           tagName: el.tagName.toLowerCase(),
//         });
//       });
//     });
//     return candidates.slice(0, 20);
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
// async function countInteractiveElements(page: Page): Promise<number> {
//   return page.evaluate(
//     () =>
//       document.querySelectorAll(
//         'input, button, select, textarea, [role="button"]',
//       ).length,
//   );
// }
