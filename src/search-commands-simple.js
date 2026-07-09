const axios = require('axios');

class SearchCommands {
  static async search(message, args, type = 'all') {
    const query = args.join(' ').trim();
    if (!query) return message.reply('❌ Provide a search query');

    try {
      await message.channel.sendTyping();
      let result = `🔍 **Search: ${query}**\n\n`;

      if (type === 'all' || type === 'wiki') {
        try {
          const wiki = await axios.get('https://en.wikipedia.org/w/api.php', {
            params: { action: 'query', list: 'search', srsearch: query, srlimit: 3, format: 'json', origin: '*' },
            timeout: 3000
          });
          if (wiki.data.query?.search?.length) {
            result += `**📚 Wikipedia:**\n`;
            wiki.data.query.search.slice(0, 2).forEach((r, i) => {
              result += `${i+1}. ${r.title}\n`;
            });
            result += '\n';
          }
        } catch (e) {}
      }

      if (type === 'all' || type === 'web') {
        try {
          const web = await axios.get('https://api.duckduckgo.com/', {
            params: { q: query, format: 'json', no_html: 1 },
            timeout: 3000
          });
          if (web.data.AbstractText) {
            result += `**🌐 Web:**\n${web.data.AbstractText.substring(0, 200)}...\n\n`;
          }
        } catch (e) {}
      }

      if (type === 'all' || type === 'github') {
        try {
          const gh = await axios.get('https://api.github.com/search/repositories', {
            params: { q: query, sort: 'stars', per_page: 3 },
            timeout: 3000
          });
          if (gh.data.items?.length) {
            result += `**💻 GitHub:**\n`;
            gh.data.items.slice(0, 2).forEach((r, i) => {
              result += `${i+1}. ${r.full_name} ⭐${r.stargazers_count}\n`;
            });
          }
        } catch (e) {}
      }

      return message.reply(result || '❌ No results');
    } catch (error) {
      return message.reply(`❌ Search error: ${error.message}`);
    }
  }

  static async weather(message, args) {
    const city = args.join(' ').trim();
    if (!city) return message.reply('❌ Provide a city name');

    try {
      const weather = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, { timeout: 5000 });
      const c = weather.data.current_condition[0];
      
      return message.reply(`🌤️ **${city}:**
Temperature: ${c.temp_C}°C / ${c.temp_F}°F
Condition: ${c.condition[0].text}
Humidity: ${c.humidity}%
Wind: ${c.windspeedKmph} km/h`);
    } catch (error) {
      return message.reply(`❌ Weather error`);
    }
  }

  static async crypto(message, args) {
    const coin = (args[0] || 'bitcoin').toLowerCase();

    try {
      const price = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: { ids: coin, vs_currencies: 'usd,eur,cny', include_market_cap: true },
        timeout: 5000
      });

      if (!price.data[coin]) return message.reply(`❌ Coin not found`);

      const p = price.data[coin];
      return message.reply(`💰 **${coin.toUpperCase()}:**
USD: $${p.usd}
EUR: €${p.eur}
CNY: ¥${p.cny}`);
    } catch (error) {
      return message.reply(`❌ Crypto error`);
    }
  }

  static async ipInfo(message, args) {
    const ip = args[0];
    if (!ip) return message.reply('❌ Provide an IP address');

    try {
      const info = await axios.get(`https://ipapi.co/${ip}/json/`, { timeout: 5000 });
      
      return message.reply(`🌐 **IP: ${ip}**
Country: ${info.data.country_name}
City: ${info.data.city}
Org: ${info.data.org}`);
    } catch (error) {
      return message.reply(`❌ IP error`);
    }
  }

  static async translate(message, args) {
    const lang = args[0];
    const text = args.slice(1).join(' ');
    
    if (!lang || !text) return message.reply('❌ Usage: !translate en hello');

    try {
      const res = await axios.post('https://libretranslate.de/translate', {
        q: text,
        source: 'auto',
        target: lang
      }, { timeout: 5000 });

      return message.reply(`🔤 **${lang}:**\n${res.data.translatedText}`);
    } catch (error) {
      return message.reply(`❌ Translation error`);
    }
  }

  static async analyzeText(message, args) {
    const text = args.join(' ');
    if (!text) return message.reply('❌ Provide text');

    const analysis = {
      length: text.length,
      words: text.split(/\s+/).length,
      sentences: (text.match(/[.!?]/g) || []).length,
      unique: new Set(text.toLowerCase().split(/\s+/)).size
    };

    return message.reply(`📝 **Analysis:**
Chars: ${analysis.length}
Words: ${analysis.words}
Sentences: ${analysis.sentences}
Unique: ${analysis.unique}`);
  }

  static async summarize(message, args) {
    const text = args.join(' ');
    if (!text) return message.reply('❌ Provide text');

    try {
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
      if (sentences.length <= 2) {
        return message.reply(`📋\n${text}`);
      }

      const summary = sentences.slice(0, 2).join(' ').substring(0, 500);
      return message.reply(`📋\n${summary}`);
    } catch (error) {
      return message.reply(`❌ Error`);
    }
  }
}

module.exports = SearchCommands;
