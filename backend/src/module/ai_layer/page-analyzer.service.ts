import { chromium } from "playwright";

export async function analyzePage(url: string) {
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const page = await browser.newPage();

    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    const pageData = await page.evaluate(() => {
      const isVisible = (el: Element) => {
        const style = window.getComputedStyle(el);

        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          style.opacity !== "0" &&
          (el as HTMLElement).offsetParent !== null
        );
      };

      const getXPath = (element: Element) => {
        if (element.id) {
          return `//*[@id="${element.id}"]`;
        }

        const parts: string[] = [];
        let current: Element | null = element;

        while (current && current.nodeType === Node.ELEMENT_NODE) {
          let index = 1;

          let sibling = current.previousElementSibling;

          while (sibling) {
            if (sibling.tagName === current.tagName) {
              index++;
            }
            sibling = sibling.previousElementSibling;
          }

          parts.unshift(`${current.tagName.toLowerCase()}[${index}]`);

          current = current.parentElement;
        }

        return "/" + parts.join("/");
      };

      const getCssPath = (element: Element) => {
        const path: string[] = [];

        let current: Element | null = element;

        while (current && current !== document.body) {
          let selector = current.tagName.toLowerCase();

          if ((current as HTMLElement).id) {
            selector += `#${(current as HTMLElement).id}`;
            path.unshift(selector);
            break;
          }

          const className = (current as HTMLElement).className
            ?.toString()
            ?.trim()
            ?.split(" ")
            ?.filter(Boolean)?.[0];

          if (className) {
            selector += `.${className}`;
          }

          path.unshift(selector);

          current = current.parentElement;
        }

        return path.join(" > ");
      };

      const getAncestors = (element: Element) => {
        const ancestors: string[] = [];

        let current = element.parentElement;

        while (current && ancestors.length < 5) {
          ancestors.push(current.tagName.toLowerCase());
          current = current.parentElement;
        }

        return ancestors;
      };

      const getFormInfo = (element: Element) => {
        const form = element.closest("form");

        if (!form) return null;

        return {
          formId: form.id || null,
          action: form.getAttribute("action"),
          method: form.getAttribute("method"),
        };
      };

      const getLabel = (element: Element) => {
        const input = element as HTMLInputElement;

        // Strategy 1
        if (input.id) {
          const label = document.querySelector(`label[for="${input.id}"]`);

          if (label?.textContent?.trim()) {
            return label.textContent.trim();
          }
        }

        // Strategy 2
        const parentLabel = input.closest("label");

        if (parentLabel?.textContent?.trim()) {
          return parentLabel.textContent.trim();
        }

        // Strategy 3
        let prev = input.previousElementSibling;

        while (prev) {
          if (prev.tagName.toLowerCase() === "label") {
            return prev.textContent?.trim() || null;
          }

          prev = prev.previousElementSibling;
        }

        return null;
      };

      const buildSelectors = (el: Element) => {
        const element = el as HTMLElement;

        return {
          id: element.id || null,
          name: element.getAttribute("name"),
          ariaLabel: element.getAttribute("aria-label"),

          dataTestId: element.getAttribute("data-testid"),
          dataTest: element.getAttribute("data-test"),
          dataCy: element.getAttribute("data-cy"),

          css: getCssPath(element),
          xpath: getXPath(element),
        };
      };

      // INPUTS
      const inputs = Array.from(document.querySelectorAll("input, textarea"))
        .filter(isVisible)
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute("type"),

          id: el.id,
          name: el.getAttribute("name"),

          placeholder: el.getAttribute("placeholder"),

          ariaLabel: el.getAttribute("aria-label"),

          label: getLabel(el),

          selectors: buildSelectors(el),

          ancestors: getAncestors(el),

          form: getFormInfo(el),
        }));

      // BUTTONS
      const buttons = Array.from(document.querySelectorAll("button"))
        .filter(isVisible)
        .map((el) => ({
          text: el.textContent?.trim(),

          id: el.id,
          name: el.getAttribute("name"),

          ariaLabel: el.getAttribute("aria-label"),

          selectors: {
            ...buildSelectors(el),
            text: el.textContent?.trim(),
          },

          ancestors: getAncestors(el),

          form: getFormInfo(el),
        }));

      // LINKS
      const links = Array.from(document.querySelectorAll("a"))
        .filter(isVisible)
        .slice(0, 50)
        .map((el) => ({
          text: el.textContent?.trim(),
          href: el.getAttribute("href"),
          ariaLabel: el.getAttribute("aria-label"),
        }));

      // HEADINGS
      const headings = Array.from(
        document.querySelectorAll("h1,h2,h3,h4,h5,h6"),
      )
        .filter(isVisible)
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          text: el.textContent?.trim(),
        }));

      // LABELS
      const labels = Array.from(document.querySelectorAll("label"))
        .filter(isVisible)
        .map((el) => ({
          text: el.textContent?.trim(),
          for: el.getAttribute("for"),
        }));

      // FORMS
      const forms = Array.from(document.querySelectorAll("form")).map(
        (form) => ({
          id: form.id,
          action: form.getAttribute("action"),
          method: form.getAttribute("method"),
        }),
      );

      // SELECTS
      const selects = Array.from(document.querySelectorAll("select"))
        .filter(isVisible)
        .map((el) => ({
          id: el.id,

          name: el.getAttribute("name"),

          label: getLabel(el),

          selectors: buildSelectors(el),

          ancestors: getAncestors(el),

          form: getFormInfo(el),

          options: Array.from(el.querySelectorAll("option")).map((option) => ({
            text: option.textContent?.trim(),
            value: option.getAttribute("value"),
          })),
        }));

      // TABLES
      const tables = Array.from(document.querySelectorAll("table"))
        .filter(isVisible)
        .map((table) => ({
          headers: Array.from(table.querySelectorAll("th")).map((th) =>
            th.textContent?.trim(),
          ),
        }));

      // TEXT CONTENT
      const textContent = Array.from(
        document.querySelectorAll("p,span,div,strong"),
      )
        .filter(isVisible)
        .map((el) => el.textContent?.trim())
        .filter(Boolean)
        .slice(0, 100);

      // ARIA ELEMENTS
      const ariaElements = Array.from(document.querySelectorAll("[aria-label]"))
        .filter(isVisible)
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          ariaLabel: el.getAttribute("aria-label"),
          selector: buildSelectors(el),
        }));

      return {
        title: document.title,
        url: window.location.href,

        inputs,
        buttons,
        links,
        headings,
        labels,
        forms,
        selects,
        tables,
        textContent,
        ariaElements,
      };
    });

    return pageData;
  } finally {
    await browser.close();
  }
}
