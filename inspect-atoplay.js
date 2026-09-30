const { chromium } = require("playwright");

(async () => {
  console.log("Connecting to existing Chrome...");

  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");

  const contexts = browser.contexts();

  if (!contexts.length) {
    throw new Error("No Chrome context found.");
  }

  const pages = contexts[0].pages();

  console.log(`Found ${pages.length} open page(s).`);

  const page = pages.find(p =>
    p.url().includes("atoplay.com/video-upload")
  );

  if (!page) {
    console.log("AtoPlay upload page not found.");
    console.log("Open:", pages.map(p => p.url()));
    process.exit(1);
  }

  console.log("\nAtoPlay upload page found:");
  console.log(page.url());

  console.log("\n========== FILE INPUTS ==========");

  const inputs = await page.locator("input").evaluateAll(elements =>
    elements.map((el, i) => ({
      index: i,
      type: el.type,
      name: el.name,
      id: el.id,
      accept: el.accept,
      placeholder: el.placeholder,
      className: el.className
    }))
  );

  console.dir(inputs, { depth: null });

  console.log("\n========== BUTTONS ==========");

  const buttons = await page.locator("button").evaluateAll(elements =>
    elements.map((el, i) => ({
      index: i,
      text: el.innerText.trim(),
      type: el.type,
      disabled: el.disabled,
      className: el.className
    }))
  );

  console.dir(buttons, { depth: null });

  console.log("\n========== SELECTS ==========");

  const selects = await page.locator("select").evaluateAll(elements =>
    elements.map((el, i) => ({
      index: i,
      name: el.name,
      id: el.id,
      options: [...el.options].map(o => ({
        text: o.text,
        value: o.value
      }))
    }))
  );

  console.dir(selects, { depth: null });

  console.log("\n========== TEXTAREAS ==========");

  const textareas = await page.locator("textarea").evaluateAll(elements =>
    elements.map((el, i) => ({
      index: i,
      name: el.name,
      id: el.id,
      placeholder: el.placeholder
    }))
  );

  console.dir(textareas, { depth: null });

  console.log("\n========== LINKS ==========");

  const links = await page.locator("a").evaluateAll(elements =>
    elements.map((el, i) => ({
      index: i,
      text: el.innerText.trim(),
      href: el.href
    }))
  );

  console.dir(links, { depth: null });

  console.log("\nInspection complete.");
  await browser.close();
})();