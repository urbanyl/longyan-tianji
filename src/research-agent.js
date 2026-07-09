const axios = require('axios');
const { clip, stripHtml, take } = require('./utils');

class ResearchAgent {
  constructor(config) {
    this.config = config;
    this.http = axios.create({
      timeout: 12000,
      headers: {
        'User-Agent': 'Longyan-Tianji/1.0'
      }
    });
  }

  async search(query) {
    const target = String(query || '').trim();
    if (!target) return { query: target, sources: [] };

    const jobs = [this.wikipedia(target), this.duckDuckGo(target)];
    if (this.config.serpApiKey) jobs.unshift(this.serpApi(target));

    const settled = await Promise.allSettled(jobs);
    const sources = settled.map((item) =>
      item.status === 'fulfilled' ? item.value : { source: 'unknown', error: item.reason.message }
    );

    return { query: target, sources };
  }

  async serpApi(query) {
    const response = await this.http.get('https://serpapi.com/search.json', {
      params: { q: query, api_key: this.config.serpApiKey }
    });

    return {
      source: 'serpapi',
      results: take(response.data.organic_results || [], 5).map((item) => ({
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
      results: take(response.data.query?.search || [], 5).map((item) => ({
        title: item.title,
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

    const related = take(response.data.RelatedTopics || [], 5)
      .map((item) => item.Topics || item)
      .flat()
      .filter((item) => item.Text || item.FirstURL)
      .slice(0, 5);

    return {
      source: 'duckduckgo',
      abstract: clip(response.data.AbstractText || '', 400),
      results: related.map((item) => ({
        title: item.Text ? item.Text.split(' - ')[0] : item.FirstURL,
        link: item.FirstURL,
        snippet: clip(item.Text || '', 240)
      }))
    };
  }
}

module.exports = ResearchAgent;
