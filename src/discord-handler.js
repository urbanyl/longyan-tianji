const path = require('path');
const { promises: fs } = require('fs');
const { AccessController, RateLimiter } = require('./security');
const { clip, formatMs, isPathInside, redactSecrets } = require('./utils');

class DiscordHandler {
  constructor(client, orchestrator, config) {
    this.client = client;
    this.orchestrator = orchestrator;
    this.config = config;
    this.brand = config.brand;
    this.commands = new Map();
    this.access = new AccessController({
      ...config.security,
      memoryScope: config.memory.scope
    });
    this.rateLimiter = new RateLimiter(config.security);
    this.register();
    this.events();
  }

  register() {
    this.commands.set('exec', (message, args) => this.exec(message, args));
    this.commands.set('run', (message, args) => this.exec(message, args));
    this.commands.set('status', (message, args) => this.status(message, args));
    this.commands.set('cancel', (message, args) => this.cancel(message, args));
    this.commands.set('memory', (message, args) => this.memory(message, args));
    this.commands.set('session', (message, args) => this.session(message, args));
    this.commands.set('queue', (message) => this.queue(message));
    this.commands.set('health', (message) => this.health(message));
    this.commands.set('ping', (message) => message.reply('pong'));
    this.commands.set('name', (message) => message.reply(`${this.brand.project} is pronounced "Long Yan". ${this.brand.bot} is pronounced "Tian Ji".`));
    this.commands.set('help', (message) => this.help(message));
  }

  events() {
    this.orchestrator.on('taskCompleted', (task) => {
      console.log(`${this.brand.bot} completed ${task.id} in ${formatMs(task.duration)}`);
    });

    this.orchestrator.on('taskFailed', (task) => {
      console.error(`${this.brand.bot} ${task.status} ${task.id}: ${task.error || 'no error'}`);
    });

    this.orchestrator.on('memoryError', (error) => {
      console.error(`${this.brand.bot} memory error: ${error.message}`);
    });
  }

  async exec(message, args) {
    const command = args.join(' ').trim();
    if (!command) return message.reply(`Send a command after ${this.brand.prefix}exec.`);

    const task = await this.orchestrator.execute(command, {
      sessionId: message.author.id,
      userId: message.author.id,
      channelId: message.channel.id,
      guildId: message.guildId || null
    });

    const done = await this.orchestrator.waitForTask(task.id, this.config.execution.replyWaitMs);

    if (!done || !['completed', 'failed', 'cancelled'].includes(done.status)) {
      return message.reply(`${this.brand.bot} queued ${task.id}. Use ${this.brand.prefix}status ${task.id}.`);
    }

    return await this.replyWithTask(message, done);
  }

  async status(message, args) {
    const taskId = args[0];
    if (!taskId) return message.reply('Send a task id.');

    const task = await this.orchestrator.getStatus(taskId);
    if (!task) return message.reply('Task not found.');
    if (!this.access.canReadTask(message, task)) return message.reply('Task not found.');

    return await this.replyWithTask(message, task);
  }

  async cancel(message, args) {
    const taskId = args[0];
    if (!taskId) return message.reply('Send a task id.');

    const existing = await this.orchestrator.getStatus(taskId);
    if (!existing || !this.access.canReadTask(message, existing)) return message.reply(`Task ${taskId} was not found.`);

    const task = await this.orchestrator.cancelTask(taskId);
    return message.reply(task ? `Cancelled ${taskId}.` : `Task ${taskId} was not found.`);
  }

  async memory(message, args) {
    const action = (args[0] || '').toLowerCase();

    if (!action) return message.reply(`Usage: ${this.brand.prefix}memory set key value | get key | list | delete key`);
    const prefix = this.access.memoryPrefix(message);

    if (action === 'list') {
      const items = await this.orchestrator.memory.listMemory(this.config.memory.listLimit, prefix);
      if (!items.length) return message.reply('Memory is empty.');
      const lines = items.map((item) => `${item.key.slice(prefix.length)}: ${clip(redactSecrets(item.value), 80)}`).join('\n');
      return message.reply(`\`\`\`\n${clip(lines, 1800)}\n\`\`\``);
    }

    if (action === 'delete') {
      const key = args[1];
      if (!key) return message.reply('Send a key.');
      const deleted = await this.orchestrator.memory.deleteMemory(`${prefix}${key}`);
      return message.reply(deleted ? `Deleted ${key}.` : `${key} was not found.`);
    }

    if (action === 'get') {
      const key = args[1];
      if (!key) return message.reply('Send a key.');
      const value = await this.orchestrator.memory.getMemory(`${prefix}${key}`);
      return message.reply(`\`\`\`\n${clip(redactSecrets(value ?? 'empty'), 1800)}\n\`\`\``);
    }

    const key = action === 'set' ? args[1] : args[0];
    const value = action === 'set' ? args.slice(2).join(' ') : args.slice(1).join(' ');

    if (!key || !value) return message.reply(`Usage: ${this.brand.prefix}memory set key value`);
    if (key.includes(':')) return message.reply('Memory keys cannot contain colon characters.');
    if (value.length > this.config.memory.maxValueChars) {
      return message.reply(`Memory value is too long. Limit: ${this.config.memory.maxValueChars} characters.`);
    }
    await this.orchestrator.memory.setMemory(`${prefix}${key}`, value);
    return message.reply(`Stored ${key}.`);
  }

  async session(message, args) {
    const sessionId = args[0] || message.author.id;
    if (!this.access.canUseSession(message, sessionId)) return message.reply('No tasks found for this session.');

    const tasks = await this.orchestrator.getSession(sessionId);

    if (!tasks.length) return message.reply('No tasks found for this session.');

    const lines = tasks
      .slice(0, 12)
      .map((task) => `${task.status.padEnd(9)} ${task.id.slice(0, 8)} ${formatMs(task.duration || 0).padStart(6)} ${clip(task.command, 72)}`)
      .join('\n');

    return message.reply(`\`\`\`\n${lines}\n\`\`\``);
  }

  async queue(message) {
    const state = this.orchestrator.queueState();
    const lines = [
      `active: ${state.active.length}`,
      `queued: ${state.queued.length}`,
      ...state.active.map((task) => `run ${task.id.slice(0, 8)} ${formatMs(task.ageMs)} ${clip(task.command, 70)}`),
      ...state.queued.map((task) => `wait ${task.id.slice(0, 8)} ${formatMs(task.ageMs)} ${clip(task.command, 70)}`)
    ];
    return message.reply(`\`\`\`\n${clip(lines.join('\n'), 1800)}\n\`\`\``);
  }

  async health(message) {
    const health = await this.orchestrator.health();
    return message.reply(`\`\`\`json\n${clip(redactSecrets(health), 1800)}\n\`\`\``);
  }

  async help(message) {
    const p = this.brand.prefix;
    const body = [
      `${this.brand.bot} commands`,
      `${p}exec open https://example.com screenshot`,
      `${p}exec scrape selector:h1`,
      `${p}exec run python code: print(sum(range(100)))`,
      `${p}exec generate pdf content:"Daily brief"`,
      `${p}exec create excel data:[{"name":"Longyan","role":"project"}]`,
      `${p}status task_id`,
      `${p}queue`,
      `${p}memory set key value`,
      `${p}session`
    ].join('\n');
    return message.reply(`\`\`\`\n${body}\n\`\`\``);
  }

  async replyWithTask(message, task) {
    const files = await this.extractFiles(task);
    const status = task.status || 'unknown';
    const duration = task.duration ? ` in ${formatMs(task.duration)}` : '';
    const header = `${this.brand.bot} ${status}${duration} ${task.id ? `[${task.id.slice(0, 8)}]` : ''}`.trim();
    const payload = status === 'completed' ? task.result : { error: task.error, progress: task.progress };
    const content = `${header}\n\`\`\`json\n${clip(redactSecrets(payload), this.config.output.maxReplyChars)}\n\`\`\``;

    return message.reply({
      content: clip(content, 2000),
      files
    });
  }

  async extractFiles(task) {
    const artifacts = task.artifacts || task.result?.artifacts || [];
    const files = [];

    for (const artifact of artifacts.slice(0, this.config.output.maxAttachmentFiles)) {
      const filepath = path.resolve(artifact.filepath || '');
      if (!isPathInside(this.config.output.tempDir, filepath)) continue;

      const stat = await fs.stat(filepath).catch(() => null);
      if (!stat || !stat.isFile() || stat.size > this.config.output.maxAttachmentBytes) continue;

      files.push({
        attachment: filepath,
        name: artifact.filename || path.basename(filepath)
      });
    }

    return files;
  }

  async handleMessage(message) {
    if (!message || message.author.bot || !message.content.startsWith(this.brand.prefix)) return;

    const body = message.content.slice(this.brand.prefix.length).trim();
    const [name, ...args] = body.split(/\s+/);
    const commandName = (name || '').toLowerCase();
    const command = this.commands.get(commandName);

    if (!command) return;

    try {
      const access = this.access.canRun(message, commandName);
      if (!access.ok) {
        console.warn(`${this.brand.bot} denied command=${commandName} user=${message.author.id} channel=${message.channel.id} reason=${access.reason}`);
        return await message.reply(access.reason);
      }

      const rate = this.rateLimiter.check(message, access.admin);
      if (!rate.ok) {
        console.warn(`${this.brand.bot} rate-limited user=${message.author.id} command=${commandName}`);
        return await message.reply(`Rate limit reached. Try again in ${Math.ceil(rate.retryAfterMs / 1000)}s.`);
      }

      console.log(`${this.brand.bot} accepted command=${commandName} user=${message.author.id} channel=${message.channel.id}`);
      await command(message, args);
    } catch (error) {
      await message.reply(`${this.brand.bot} error: ${redactSecrets(error.message)}`);
    }
  }
}

module.exports = DiscordHandler;
