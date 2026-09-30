const { chromium } = require("playwright");

(async () => {

  console.log("======================================");
  console.log(" AtoPlay Inspector V2");
  console.log("======================================");

  console.log("\nConnecting to Chrome...");

  const browser = await chromium.connectOverCDP(
    "http://127.0.0.1:9222"
  );

  const context = browser.contexts()[0];

  if (!context) {
    throw new Error("No Chrome context found.");
  }

  const pages = context.pages();

  console.log(`Found ${pages.length} page(s).`);

  for (let i = 0; i < pages.length; i++) {
    console.log(`${i + 1}. ${pages[i].url()}`);
  }

  console.log("\nSearching for the active AtoPlay page...");

  let selectedPage = null;

  for (let i = 0; i < pages.length; i++) {

    const page = pages[i];

    if (!page.url().includes("atoplay.com/video-upload")) {
      continue;
    }

    console.log(`\nChecking AtoPlay page ${i + 1}...`);

    try {

      await page.bringToFront();

      await page.waitForTimeout(2000);

      const bodyText = await page
        .locator("body")
        .innerText({ timeout: 3000 })
        .catch(() => "");

      console.log(
        "Visible text length:",
        bodyText.length
      );

      if (bodyText.length > 50) {

        console.log(
          "This appears to be the real AtoPlay page."
        );

        selectedPage = page;

        break;
      }

    } catch (error) {

      console.log(
        "Could not inspect this page:",
        error.message
      );

    }
  }

  if (!selectedPage) {

    console.log("\n======================================");
    console.log(" ATO PLAY PAGE NOT FOUND");
    console.log("======================================");

    console.log(
      "No AtoPlay page with visible content was found."
    );

    console.log(
      "Make sure the AtoPlay upload page is visible in Chrome."
    );

    return;
  }

  console.log("\n======================================");
  console.log(" REAL ATO PLAY PAGE FOUND");
  console.log("======================================");

  console.log(
    "URL:",
    selectedPage.url()
  );

  console.log("\nWaiting for page to settle...");

  await selectedPage.waitForTimeout(3000);

  console.log("\n======================================");
  console.log(" PAGE TEXT");
  console.log("======================================");

  try {

    const text =
      await selectedPage
        .locator("body")
        .innerText();

    console.log(text.substring(0, 8000));

  } catch (error) {

    console.log(
      "Could not read page text:",
      error.message
    );

  }

  console.log("\n======================================");
  console.log(" FILE INPUTS");
  console.log("======================================");

  try {

    const count =
      await selectedPage
        .locator('input[type="file"]')
        .count();

    console.log(
      "File input count:",
      count
    );

    for (let i = 0; i < count; i++) {

      const input =
        selectedPage
          .locator('input[type="file"]')
          .nth(i);

      console.log(`\nFile input ${i}`);

      console.log(
        "accept:",
        await input.getAttribute("accept")
      );

      console.log(
        "name:",
        await input.getAttribute("name")
      );

      console.log(
        "id:",
        await input.getAttribute("id")
      );

      console.log(
        "class:",
        await input.getAttribute("class")
      );

    }

  } catch (error) {

    console.log(
      "File input error:",
      error.message
    );

  }

  console.log("\n======================================");
  console.log(" BUTTONS");
  console.log("======================================");

  try {

    const count =
      await selectedPage
        .locator("button")
        .count();

    console.log(
      "Button count:",
      count
    );

    for (let i = 0; i < count; i++) {

      const button =
        selectedPage
          .locator("button")
          .nth(i);

      console.log(`\nButton ${i}`);

      console.log(
        "text:",
        (await button.innerText()).trim()
      );

      console.log(
        "type:",
        await button.getAttribute("type")
      );

      console.log(
        "class:",
        await button.getAttribute("class")
      );

    }

  } catch (error) {

    console.log(
      "Button error:",
      error.message
    );

  }

  console.log("\n======================================");
  console.log(" ALL INPUTS");
  console.log("======================================");

  try {

    const count =
      await selectedPage
        .locator("input")
        .count();

    console.log(
      "Input count:",
      count
    );

    for (let i = 0; i < count; i++) {

      const input =
        selectedPage
          .locator("input")
          .nth(i);

      console.log(`\nInput ${i}`);

      console.log(
        "type:",
        await input.getAttribute("type")
      );

      console.log(
        "name:",
        await input.getAttribute("name")
      );

      console.log(
        "id:",
        await input.getAttribute("id")
      );

      console.log(
        "placeholder:",
        await input.getAttribute("placeholder")
      );

      console.log(
        "class:",
        await input.getAttribute("class")
      );

    }

  } catch (error) {

    console.log(
      "Input error:",
      error.message
    );

  }

  console.log("\n======================================");
  console.log(" TEXTAREAS");
  console.log("======================================");

  try {

    const count =
      await selectedPage
        .locator("textarea")
        .count();

    console.log(
      "Textarea count:",
      count
    );

    for (let i = 0; i < count; i++) {

      const textarea =
        selectedPage
          .locator("textarea")
          .nth(i);

      console.log(`\nTextarea ${i}`);

      console.log(
        "name:",
        await textarea.getAttribute("name")
      );

      console.log(
        "id:",
        await textarea.getAttribute("id")
      );

      console.log(
        "placeholder:",
        await textarea.getAttribute("placeholder")
      );

    }

  } catch (error) {

    console.log(
      "Textarea error:",
      error.message
    );

  }

  console.log("\n======================================");
  console.log(" INSPECTION COMPLETE");
  console.log("======================================");

})();