const SearchCommands = require('./search-commands-simple');

class CommandInterceptor {
  constructor() {
    this.commands = new Map();
    this.setupCommands();
  }

  setupCommands() {
    this.commands.set('search', (msg, args) => SearchCommands.search(msg, args, 'all'));
    this.commands.set('search-wiki', (msg, args) => SearchCommands.search(msg, args, 'wiki'));
    this.commands.set('search-web', (msg, args) => SearchCommands.search(msg, args, 'web'));
    this.commands.set('search-github', (msg, args) => SearchCommands.search(msg, args, 'github'));
    this.commands.set('weather', (msg, args) => SearchCommands.weather(msg, args));
    this.commands.set('crypto', (msg, args) => SearchCommands.crypto(msg, args));
    this.commands.set('ip-info', (msg, args) => SearchCommands.ipInfo(msg, args));
    this.commands.set('translate', (msg, args) => SearchCommands.translate(msg, args));
    this.commands.set('analyze-text', (msg, args) => SearchCommands.analyzeText(msg, args));
    this.commands.set('summarize', (msg, args) => SearchCommands.summarize(msg, args));
  }

  async intercept(message, prefix) {
    if (!message.content.startsWith(prefix)) return false;

    const body = message.content.slice(prefix.length).trim();
    const [name, ...args] = body.split(/\s+/);
    const commandName = (name || '').toLowerCase();
    const command = this.commands.get(commandName);

    if (!command) return false;

    try {
      await command(message, args);
      return true;
    } catch (error) {
      console.error('Command error:', error);
      return true;
    }
  }
}

module.exports = CommandInterceptor;
