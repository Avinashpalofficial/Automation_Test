import { Page } from "playwright";
export async function discoverScrollContent(page: Page): Promise<void> {
  const viewPortHeight = page.viewportSize()?.height ?? 720;
  /* Get total height of the page */
  const pageHeight = await page.evaluate(() => document.body.scrollHeight);
  let currentScroll = 0;
  const scrollStep = viewPortHeight * 0.8;
  while (currentScroll < viewPortHeight) {
    await page.evaluate((y) => window.scrollTo(0, y), currentScroll);
    // Wait for lazy-loaded content to appear
    // IntersectionObserver-based components fire here
    await page.waitForTimeout(600);
    // Wait for any new network requests triggered by scroll to complete
    await page
      .waitForLoadState("networkidle", { timeout: 3000 })
      .catch(() => {});
    currentScroll += scrollStep;
  }
  // Scroll back to top — important so AI sees the page in natural state
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
}
