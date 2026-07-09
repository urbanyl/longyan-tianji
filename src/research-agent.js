const axios = require('axios');
const { clip, stripHtml, take } = require('./utils');

class ResearchAgent {
  constructor(config) {
    this.config = config;
    this.http = axios.create({
      timeout: config.timeoutMs,
      headers: {
        'User-Agent': 'Longyan-Tianji/1.0'
      }
    });
  }

  async search(query) {
    const target = String(query || '').trim();
    if (!target) return { query: target, sources: [] };

    const jobs = [];
    if (this.config.serpApiKey && this.config.serpApiEnabled) jobs.push(this.serpApi(target));
    if (this.config.freeSearchEnabled) {
      jobs.push(this.wikipedia(target));
      jobs.push(this.duckDuckGo(target));
      jobs.push(this.duckDuckGoHtml(target));
    }

    const settled = await Promise.allSettled(jobs);
    const sources = settled.map((item) =>
      item.status === 'fulfilled' ? item.value : { source: 'unknown', error: item.reason.message }
    );

    return {
      query: target,
      paidProviderEnabled: Boolean(this.config.serpApiKey && this.config.serpApiEnabled),
      freeSearchEnabled: this.config.freeSearchEnabled,
      sources
    };
  }

  async serpApi(query) {
    const response = await this.http.get('https://serpapi.com/search.json', {
      params: { q: query, api_key: this.config.serpApiKey }
    });

    return {
      source: 'serpapi',
      results: take(response.data.organic_results || [], this.config.maxResults).map((item) => ({
        title: item.title,
        link: item.link,
        snippet: clip(item.snippet || '', 240)
      }))
    };
  }

  async wikipedia(query) {
    const response = await this.http.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        list: 'search',
        srsearch: query,
        format: 'json',
        origin: '*'
      }
    });

    return {
      source: 'wikipedia',
      results: take(response.data.query?.search || [], this.config.maxResults).map((item) => ({
        title: item.title,
        link: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/\s+/g, '_'))}`,
        snippet: clip(stripHtml(item.snippet), 240)
      }))
    };
  }

  async duckDuckGo(query) {
    const response = await this.http.get('https://api.duckduckgo.com/', {
      params: {
        q: query,
        format: 'json',
        no_html: 1,
        skip_disambig: 1
      }
    });

    const related = take(response.data.RelatedTopics || [], this.config.maxResults)
      .map((item) => item.Topics || item)
      .flat()
      .filter((item) => item.Text || item.FirstURL)
      .slice(0, this.config.maxResults);

    return {
      source: 'duckduckgo-instant-answer',
      abstract: clip(response.data.AbstractText || '', 400),
      results: related.map((item) => ({
        title: item.Text ? item.Text.split(' - ')[0] : item.FirstURL,
        link: item.FirstURL,
        snippet: clip(item.Text || '', 240)
      }))
    };
  }

  async duckDuckGoHtml(query) {
    const response = await this.http.get('https://html.duckduckgo.com/html/', {
      params: { q: query }
    });

    const html = String(response.data || '');
    const blocks = html.split(/<div class="result[\s"]/i).slice(1);
    const results = [];

    for (const block of blocks) {
      const titleMatch = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!titleMatch) continue;
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>|class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i);
      const link = this.decodeHtml(titleMatch[1]);
      const title = stripHtml(this.decodeHtml(titleMatch[2]));
      const snippet = stripHtml(this.decodeHtml(snippetMatch?.[1] || snippetMatch?.[2] || ''));
      if (title && link) results.push({ title, link, snippet: clip(snippet, 240) });
      if (results.length >= this.config.maxResults) break;
    }

    return {
      source: 'duckduckgo-html',
      results
    };
  }

  decodeHtml(value) {
    return String(value || '')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }
}

module.exports = ResearchAgent;
