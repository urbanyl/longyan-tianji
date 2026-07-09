const {
  codeFence,
  extractJsonPayload,
  normalizeUrl,
  readField,
  readFields,
  splitSegments
} = require('./utils');

class CommandPlanner {
  plan(command) {
    const segments = splitSegments(command);
    return {
      raw: command,
      steps: segments.map((segment, index) => this.step(segment, index + 1))
    };
  }

  step(segment, index) {
    const type = this.type(segment);
    const parser = {
      browser: () => this.browser(segment),
      code: () => this.code(segment),
      file: () => this.file(segment),
      research: () => this.research(segment),
      general: () => ({ text: segment })
    }[type];

    return {
      index,
      type,
      original: segment,
      input: parser()
    };
  }

  type(segment) {
    const text = segment.toLowerCase();
    if (/```|\b(code|python|javascript|node)\b|code:/i.test(segment)) return 'code';
    if (/\b(pdf|excel|xlsx|image|report|json file|export)\b/i.test(segment)) return 'file';
    if (/\b(open|go to|browse|scrape|selector:|screenshot|click|fill|type|press|links|page text|eval:)\b|https?:\/\/|(?:[a-z0-9-]+\.)+[a-z]{2,}/i.test(segment)) return 'browser';
    if (/\b(search|research|lookup|wikipedia|public web|find)\b/i.test(segment)) return 'research';
    if (/\bosint\b/i.test(text)) return 'research';
    return 'general';
  }

  browser(segment) {
    const urlMatch = segment.match(/https?:\/\/[^\s]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/i);
    const selectors = readFields(segment, 'selector');
    const scrapeSelectors = readFields(segment, 'scrape');
    const clickSelectors = readFields(segment, 'click');
    const fieldSelectors = readFields(segment, 'fill').concat(readFields(segment, 'type'));
    const text = readField(segment, 'text');
    const key = readField(segment, 'key') || readField(segment, 'press');
    const evaluate = readField(segment, 'eval');
    const wantsScrape = /\bscrape\b/i.test(segment);
    const wantsClick = /\bclick\b/i.test(segment);

    return {
      url: urlMatch ? normalizeUrl(urlMatch[0]) : null,
      clicks: clickSelectors.length ? clickSelectors : wantsClick ? selectors : [],
      scrapes: scrapeSelectors.length ? scrapeSelectors : wantsScrape ? selectors : [],
      fills: fieldSelectors.map((selector) => ({ selector, text })),
      keys: key ? [key] : [],
      links: /\blinks?\b/i.test(segment),
      text: /\b(page text|body text|text dump|read page)\b/i.test(segment),
      textLimit: 4000,
      limit: 20,
      evaluate,
      screenshot: /\bscreenshot|capture\b/i.test(segment)
    };
  }

  code(segment) {
    const fenced = codeFence(segment);
    const inline = segment.match(/\bcode:\s*([\s\S]+)$/i);
    const languageHint = fenced?.language || segment;
    const language = /javascript|node|js/i.test(languageHint) ? 'javascript' : 'python';

    return {
      language,
      code: fenced ? fenced.code : inline ? inline[1].trim() : ''
    };
  }

  file(segment) {
    const content = readField(segment, 'content') || readField(segment, 'text');
    const title = readField(segment, 'title');
    const name = readField(segment, 'name');
    const json = extractJsonPayload(segment);

    return {
      pdf: /\bpdf|report\b/i.test(segment),
      excel: /\bexcel|xlsx\b/i.test(segment),
      image: /\bimage|card|banner\b/i.test(segment),
      jsonFile: /\bjson file|export json\b/i.test(segment),
      content,
      title,
      name,
      data: json
    };
  }

  research(segment) {
    const query = segment
      .replace(/\b(osint|search|research|lookup|wikipedia|public web|find|for|about)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return { query: query || segment.trim() };
  }
}

module.exports = CommandPlanner;
