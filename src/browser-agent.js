const playwright = require('playwright');
const { clip, createLock, normalizeUrl, take } = require('./utils');

class BrowserAgent {
  constructor(config, brand) {
    this.config = config;
    this.brand = brand;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.lock = createLock();
  }

  async init() {
    if (this.page) return this;

    this.browser = await playwright.chromium.launch({
      headless: this.config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.context = await this.browser.newContext({
      viewport: this.config.viewport,
      userAgent: `${this.brand.project}/${this.brand.bot}`
    });

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(this.config.timeoutMs);
    this.page.setDefaultNavigationTimeout(this.config.timeoutMs);
    return this;
  }

  async execute(input) {
    return await this.lock(async () => {
      await this.init();

      const page = this.page;
      const actions = [];
      let screenshot = null;

      if (input.url) {
        const url = normalizeUrl(input.url);
        await page.goto(url, { waitUntil: 'networkidle' });
        actions.push({ action: 'open', url: page.url(), title: await page.title() });
      }

      for (const field of input.fills) {
        await page.waitForSelector(field.selector);
        await page.fill(field.selector, field.text);
        actions.push({ action: 'fill', selector: field.selector });
      }

      for (const key of input.keys) {
        await page.keyboard.press(key);
        actions.push({ action: 'press', key });
      }

      for (const selector of input.clicks) {
        await page.waitForSelector(selector);
        await page.click(selector);
        actions.push({ action: 'click', selector });
      }

      for (const selector of input.scrapes) {
        await page.waitForSelector(selector);
        const data = await page.$$eval(selector, (elements) =>
          elements.map((element) => element.textContent.trim()).filter(Boolean)
        );
        actions.push({ action: 'scrape', selector, data: take(data, input.limit) });
      }

      if (input.links) {
        const links = await page.$$eval('a[href]', (anchors) =>
          anchors
            .map((anchor) => ({
              text: anchor.textContent.trim(),
              href: anchor.href
            }))
            .filter((link) => link.href)
        );
        actions.push({ action: 'links', data: take(links, input.limit) });
      }

      if (input.text) {
        const body = await page.locator('body').innerText().catch(() => '');
        actions.push({ action: 'text', data: clip(body, input.textLimit) });
      }

      if (input.evaluate) {
        const value = await page.evaluate(input.evaluate);
        actions.push({ action: 'evaluate', data: value });
      }

      if (input.screenshot) {
        screenshot = await page.screenshot({ fullPage: true });
        actions.push({ action: 'screenshot' });
      }

      return {
        title: await page.title().catch(() => ''),
        url: page.url(),
        actions,
        screenshot
      };
    });
  }

  async health() {
    return {
      browser: Boolean(this.browser),
      page: Boolean(this.page),
      url: this.page ? this.page.url() : null
    };
  }

  async close() {
    if (this.browser) await this.browser.close();
    this.browser = null;
    this.context = null;
    this.page = null;
  }
}

module.exports = BrowserAgent;
