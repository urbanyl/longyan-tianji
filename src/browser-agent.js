const dns = require('dns').promises;
const net = require('net');
const playwright = require('playwright');
const { clip, normalizeUrl, take } = require('./utils');

function hostMatches(pattern, hostname) {
  const cleanPattern = String(pattern || '').toLowerCase();
  const cleanHost = String(hostname || '').toLowerCase();
  if (!cleanPattern) return false;
  if (cleanPattern.startsWith('*.')) return cleanHost.endsWith(cleanPattern.slice(1));
  return cleanPattern === cleanHost;
}

function numberInRange(value, start, end) {
  return value >= start && value <= end;
}

function isPrivateIPv4(address) {
  const parts = address.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && numberInRange(b, 16, 31)) ||
    (a === 192 && b === 168) ||
    (a === 100 && numberInRange(b, 64, 127)) ||
    (a === 198 && numberInRange(b, 18, 19)) ||
    a >= 224
  );
}

function isPrivateIPv6(address) {
  const value = address.toLowerCase();
  return value === '::' || value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:');
}

function isPrivateIp(address) {
  const family = net.isIP(address);
  if (family === 4) return isPrivateIPv4(address);
  if (family === 6) return isPrivateIPv6(address);
  return false;
}

class BrowserAgent {
  constructor(config, brand) {
    this.config = config;
    this.brand = brand;
    this.browser = null;
    this.active = new Map();
  }

  async init() {
    if (this.browser) return this;

    const args = [];
    if (this.config.disableSandbox) args.push('--no-sandbox', '--disable-setuid-sandbox');

    this.browser = await playwright.chromium.launch({
      headless: this.config.headless,
      args
    });

    return this;
  }

  async execute(input, context = {}) {
    await this.init();

    const taskId = context.taskId || 'standalone';
    const browserContext = await this.browser.newContext({
      viewport: this.config.viewport,
      userAgent: `${this.brand.project}/${this.brand.bot}`
    });

    await browserContext.route('**/*', async (route) => {
      try {
        await this.validateUrl(route.request().url(), { enforceAllowList: false });
        await route.continue();
      } catch {
        await route.abort('blockedbyclient');
      }
    });

    const page = await browserContext.newPage();
    page.setDefaultTimeout(this.config.timeoutMs);
    page.setDefaultNavigationTimeout(this.config.timeoutMs);
    this.active.set(taskId, { context: browserContext, page });

    try {
      return await this.executeOnPage(page, input);
    } finally {
      this.active.delete(taskId);
      await browserContext.close().catch(() => {});
    }
  }

  async executeOnPage(page, input) {
    const actions = [];
    let screenshot = null;

    if (input.url) {
      const url = normalizeUrl(input.url);
      await this.validateUrl(url, { enforceAllowList: true });
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
      actions.push({ action: 'scrape', selector, data: take(data.map((item) => clip(item, 500)), input.limit) });
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
      actions.push({ action: 'links', data: take(links, this.config.maxLinks) });
    }

    if (input.text) {
      const body = await page.locator('body').innerText().catch(() => '');
      const limit = Math.min(input.textLimit || this.config.maxTextChars, this.config.maxTextChars);
      actions.push({ action: 'text', data: clip(body, limit) });
    }

    if (input.evaluate) {
      if (!this.config.allowEval) {
        throw new Error('Browser eval is disabled. Set BROWSER_ALLOW_EVAL=true only for trusted administrators.');
      }
      const value = await page.evaluate(input.evaluate);
      actions.push({ action: 'evaluate', data: value });
    }

    if (input.screenshot) {
      screenshot = await page.screenshot({ fullPage: this.config.fullPageScreenshots });
      if (screenshot.length > this.config.maxScreenshotBytes) {
        throw new Error(`Screenshot exceeds ${this.config.maxScreenshotBytes} bytes.`);
      }
      actions.push({ action: 'screenshot' });
    }

    return {
      title: await page.title().catch(() => ''),
      url: page.url(),
      actions,
      screenshot
    };
  }

  async validateUrl(value, options = {}) {
    const raw = String(value || '').trim();
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : normalizeUrl(raw));
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`Blocked protocol: ${url.protocol}`);

    const hostname = url.hostname.toLowerCase();
    if (this.config.blockedHosts.some((pattern) => hostMatches(pattern, hostname))) {
      throw new Error(`Blocked host: ${hostname}`);
    }

    if (options.enforceAllowList && this.config.allowedHosts.length) {
      const allowed = this.config.allowedHosts.some((pattern) => hostMatches(pattern, hostname));
      if (!allowed) throw new Error(`Host is not in BROWSER_ALLOWED_HOSTS: ${hostname}`);
    }

    if (this.config.allowPrivateNetworks) return;

    if (net.isIP(hostname) && isPrivateIp(hostname)) {
      throw new Error(`Blocked private network address: ${hostname}`);
    }

    const records = await dns.lookup(hostname, { all: true }).catch(() => []);
    for (const record of records) {
      if (isPrivateIp(record.address)) throw new Error(`Blocked private network address: ${hostname}`);
    }
  }

  async health() {
    return {
      browser: Boolean(this.browser),
      activeContexts: this.active.size
    };
  }

  async cancelTask(taskId) {
    const active = this.active.get(taskId);
    if (!active) return false;
    await active.context.close().catch(() => {});
    this.active.delete(taskId);
    return true;
  }

  async close() {
    for (const taskId of this.active.keys()) {
      await this.cancelTask(taskId).catch(() => {});
    }
    if (this.browser) await this.browser.close();
    this.browser = null;
    this.active.clear();
  }
}

module.exports = BrowserAgent;
