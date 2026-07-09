const path = require('path');
const { EmbedBuilder } = require('discord.js');
const { promises: fs } = require('fs');
const { AccessController, RateLimiter } = require('./security');
const { clip, formatMs, isPathInside, redactSecrets } = require('./utils');

class DiscordHandler {
  constructor(client, orchestrator, config, additionalModules = {}) {
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

    // Modules additionnels pour les nouvelles fonctionnalités
    this.userMemory = additionalModules.userMemory;
    this.embedBuilder = additionalModules.embedBuilder;
    this.authManager = additionalModules.authManager;
    this.openrouter = additionalModules.openrouter;

    // Créer le handler d'interactions
    if (this.userMemory && this.embedBuilder) {
      const InteractionHandler = require('./interaction-handler');
      this.interactionHandler = new InteractionHandler(
        client,
        orchestrator,
        config,
        additionalModules
      );
    }

    this.register();
    this.events();
  }

  register() {
    this.commands.set('exec', (message, args) => this.exec(message, args));
    this.commands.set('run', (message, args) => this.exec(message, args));
    this.commands.set('status', (message, args) => this.status(message, args));
    this.commands.set('cancel', (message, args) => this.cancel(message, args));
    this.commands.set('memory', (message, args) => this.memory(message, args));
    this.commands.set('assistant', (message, args) => this.assistant(message, args));
    this.commands.set('profile', (message, args) => this.assistant(message, args));
    this.commands.set('remember', (message, args) => this.assistant(message, ['remember', ...args]));
    this.commands.set('output', (message, args) => this.output(message, args));
    this.commands.set('reply', (message, args) => this.output(message, args));
    this.commands.set('code', (message, args) => this.codeOutput(message, args));
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
    if (!command) return message.reply({ embeds: [this.createSimpleEmbed('Error / 错误', `Send a command after ${this.brand.prefix}exec.`, 0xff0000)] });

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
    if (!taskId) return message.reply({ embeds: [this.createSimpleEmbed('Error / 错误', 'Send a task id.', 0xff0000)] });

    const task = await this.orchestrator.getStatus(taskId);
    if (!task) return message.reply({ embeds: [this.createSimpleEmbed('Error / 错误', 'Task not found.', 0xff0000)] });
    if (!this.access.canReadTask(message, task)) return message.reply('Task not found.');

    return await this.replyWithTask(message, task);
  }

  async cancel(message, args) {
    const taskId = args[0];
    if (!taskId) return message.reply('Send a task id.');

    const existing = await this.orchestrator.getStatus(taskId);
    if (!existing || !this.access.canReadTask(message, existing)) return message.reply({ embeds: [this.createSimpleEmbed('Error / 错误', `Task ${taskId} was not found.`, 0xff0000)] });

    const task = await this.orchestrator.cancelTask(taskId);
    return message.reply({ embeds: [this.createSimpleEmbed('Status / 状态', task ? `Cancelled ${taskId}. / 已取消 ${taskId}` : `Task ${taskId} was not found. / 任务 ${taskId} 未找到`, task ? 0xffaa00 : 0xff0000)] });
  }

  async memory(message, args) {
    const action = (args[0] || '').toLowerCase();

    if (!action) return message.reply({ embeds: [this.createSimpleEmbed('Usage / 用法', `Usage: ${this.brand.prefix}memory set key value | get key | list | delete key`, 0x0099ff)] });
    const prefix = this.access.memoryPrefix(message);

    if (action === 'list') {
      const items = await this.orchestrator.memory.listMemory(this.config.memory.listLimit, prefix);
      if (!items.length) return message.reply({ embeds: [this.createSimpleEmbed('Info / 信息', 'Memory is empty. / 内存为空', 0x0099ff)] });
      const lines = items.map((item) => `${item.key.slice(prefix.length)}: ${clip(redactSecrets(item.value), 80)}`).join('\n');
      return message.reply(`\`\`\`\n${clip(lines, 1800)}\n\`\`\``);
    }

    if (action === 'delete') {
      const key = args[1];
      if (!key) return message.reply({ embeds: [this.createSimpleEmbed('Error / 错误', 'Send a key. / 请发送键名', 0xff0000)] });
      const deleted = await this.orchestrator.memory.deleteMemory(`${prefix}${key}`);
      return message.reply({ embeds: [this.createSimpleEmbed('Status / 状态', deleted ? `Deleted ${key}. / 已删除 ${key}` : `${key} was not found. / ${key} 未找到`, deleted ? 0x00ff00 : 0xff0000)] });
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
    if (key.includes(':')) return message.reply({ embeds: [this.createSimpleEmbed('Error / 错误', 'Memory keys cannot contain colon characters.', 0xff0000)] });
    if (value.length > this.config.memory.maxValueChars) {
      return message.reply({ embeds: [this.createSimpleEmbed('Error / 错误', `Memory value is too long. Limit: ${this.config.memory.maxValueChars} characters.`, 0xff0000)] });
    }
    await this.orchestrator.memory.setMemory(`${prefix}${key}`, value);
    return message.reply({ embeds: [this.createSimpleEmbed('Success / 成功', `Stored ${key}. / 已存储 ${key}`, 0x00ff00)] });
  }

  async assistant(message, args) {
    const action = (args[0] || 'show').toLowerCase();
    const userId = message.author.id;

    if (['show', 'profile', 'me'].includes(action)) {
      const profile = await this.orchestrator.getProfile(userId);
      return message.reply(`\`\`\`json\n${clip(redactSecrets(profile), 1800)}\n\`\`\``);
    }

    if (['bot', 'bot-name', 'rename'].includes(action)) {
      const botName = args.slice(1).join(' ').trim();
      if (!botName) return message.reply('Send the new assistant name.');
      const profile = await this.orchestrator.updateProfile(userId, { botName });
      return message.reply(`Assistant name set to ${profile.botName}.`);
    }

    if (['call-me', 'user-name', 'username'].includes(action)) {
      const userName = args.slice(1).join(' ').trim();
      if (!userName) return message.reply('Send the name I should use for you.');
      const profile = await this.orchestrator.updateProfile(userId, { userName });
      return message.reply(`I will call you ${profile.userName}.`);
    }

    if (['style', 'speaking-style', 'tone'].includes(action)) {
      const speakingStyle = args.slice(1).join(' ').trim();
      if (!speakingStyle) return message.reply('Send the speaking style you want.');
      const profile = await this.orchestrator.updateProfile(userId, { speakingStyle });
      return message.reply(`Speaking style updated: ${profile.speakingStyle}`);
    }

    if (['personality', 'persona'].includes(action)) {
      const personality = args.slice(1).join(' ').trim();
      if (!personality) return message.reply('Send the personality instructions.');
      await this.orchestrator.updateProfile(userId, { personality });
      return message.reply('Personality updated.');
    }

    if (['notes', 'memory-notes'].includes(action)) {
      const notes = args.slice(1).join(' ').trim();
      if (!notes) return message.reply('Send the long-term notes to store.');
      await this.orchestrator.updateProfile(userId, { notes });
      return message.reply('Long-term assistant notes updated.');
    }

    if (action === 'remember') {
      const key = args[1];
      const value = args.slice(2).join(' ').trim();
      if (!key || !value) return message.reply(`Usage: ${this.brand.prefix}assistant remember key value`);
      await this.orchestrator.rememberPreference(userId, key, value);
      return message.reply(`Remembered preference ${key}.`);
    }

    if (['output', 'reply', 'reply-mode'].includes(action)) {
      return await this.output(message, args.slice(1));
    }

    if (action === 'forget') {
      const key = args[1];
      if (!key) return message.reply(`Usage: ${this.brand.prefix}assistant forget key`);
      await this.orchestrator.forgetPreference(userId, key);
      return message.reply(`Forgot preference ${key}.`);
    }

    return message.reply(`Usage: ${this.brand.prefix}assistant show | rename name | call-me name | style text | personality text | notes text | output files|summary|json|silent | remember key value | forget key`);
  }

  async output(message, args) {
    const mode = this.normalizeReplyMode(args[0]);

    if (!args[0]) {
      const current = await this.currentReplyMode(message);
      return message.reply(`Current reply mode: ${current}. Use ${this.brand.prefix}output files, summary, json, or silent.`);
    }

    if (!mode) {
      return message.reply(`Unknown reply mode. Use ${this.brand.prefix}output files, summary, json, or silent.`);
    }

    await this.orchestrator.rememberPreference(message.author.id, 'reply_mode', mode);
    return message.reply(`Reply mode set to ${mode}.`);
  }

  async codeOutput(message, args) {
    const value = String(args[0] || '').trim().toLowerCase();
    if (!value) {
      const current = await this.currentReplyMode(message);
      return message.reply(`Code/debug output is ${current === 'json' ? 'on' : 'off'}; current reply mode: ${current}.`);
    }

    if (['off', 'no', 'false', 'never', 'disable', 'disabled'].includes(value)) {
      await this.orchestrator.rememberPreference(message.author.id, 'reply_mode', 'files');
      return message.reply('Code/debug output disabled. Reply mode set to files.');
    }

    if (['on', 'yes', 'true', 'enable', 'enabled'].includes(value)) {
      await this.orchestrator.rememberPreference(message.author.id, 'reply_mode', 'json');
      return message.reply('Code/debug output enabled. Reply mode set to json.');
    }

    return message.reply(`Usage: ${this.brand.prefix}code off | on`);
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
      `${p}assistant rename Tianji`,
      `${p}assistant call-me Boss`,
      `${p}assistant style warm, concise, direct`,
      `${p}assistant remember timezone Europe/Paris`,
      `${p}output files`,
      `${p}output json`,
      `${p}code off`,
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
    const mode = await this.currentReplyMode(message);
    
    // Create bilingual embed
    const embed = this.createTaskEmbed(task, files, status, duration);
    
    if (mode === 'json') {
      const payload = status === 'completed' ? task.result : { error: task.error, progress: task.progress };
      embed.setDescription(```json
${clip(redactSecrets(payload), this.config.output.maxReplyChars)}
```);
    } else {
      const content = this.taskReplyContent(task, files, '', mode);
      if (content) embed.setDescription(content);
    }

    return message.reply({
      embeds: [embed],
      files
    });
  }

  createTaskEmbed(task, files, status, duration) {
    const statusColors = {
      completed: 0x00ff00,    // Green
      failed: 0xff0000,       // Red
      cancelled: 0xffaa00,    // Orange
      running: 0x0099ff,      // Blue
      queued: 0x999999,       // Gray
      unknown: 0x666666       // Dark gray
    };

    const statusTranslations = {
      completed: { en: 'Completed', zh: '已完成' },
      failed: { en: 'Failed', zh: '失败' },
      cancelled: { en: 'Cancelled', zh: '已取消' },
      running: { en: 'Running', zh: '运行中' },
      queued: { en: 'Queued', zh: '排队中' },
      unknown: { en: 'Unknown', zh: '未知' }
    };

    const statusText = statusTranslations[status] || statusTranslations.unknown;
    const color = statusColors[status] || statusColors.unknown;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${this.brand.project} / ${this.brand.bot}`)
      .addFields(
        { name: 'Status / 状态', value: `${statusText.en} | ${statusText.zh}`, inline: true },
        { name: 'Task ID / 任务ID', value: task.id ? task.id.slice(0, 8) : 'N/A', inline: true }
      );

    if (duration) {
      embed.addFields({ name: 'Duration / 耗时', value: duration.replace(' in ', ''), inline: true });
    }

    if (files.length > 0) {
      const fileNames = files.map(f => f.name).join(', ');
      embed.addFields({ name: 'Attachments / 附件', value: fileNames, inline: false });
    }

    if (task.error) {
      embed.addFields({ name: 'Error / 错误', value: task.error, inline: false });
    }

    embed.setTimestamp();
    embed.setFooter({ text: `${this.brand.project} v1.0.6 | Longyan Command Engine` });

    return embed;
  }

  createSimpleEmbed(title, description, color = 0x0099ff) {
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${this.brand.project} / ${this.brand.bot}`)
      .setDescription(description)
      .setTimestamp()
      .setFooter({ text: `${this.brand.project} v1.0.6 | Longyan Command Engine` });
    
    if (title) {
      embed.addFields({ name: title, value: description, inline: false });
      embed.setDescription('');
    }
    
    return embed;
  }

  normalizeReplyMode(value) {
    const clean = String(value || '').trim().toLowerCase();
    const aliases = {
      attachment: 'files',
      attachments: 'files',
      clean: 'files',
      file: 'files',
      files: 'files',
      'no-code': 'files',
      nocode: 'files',
      normal: 'summary',
      default: 'summary',
      short: 'summary',
      summary: 'summary',
      debug: 'json',
      json: 'json',
      raw: 'json',
      quiet: 'silent',
      silent: 'silent',
      status: 'silent'
    };
    return aliases[clean] || '';
  }

  async currentReplyMode(message) {
    const profile = await this.orchestrator.getProfile(message.author.id);
    return this.normalizeReplyMode(profile.preferences?.reply_mode) || this.config.output.defaultReplyMode;
  }

  taskReplyContent(task, files, header, mode) {
    const status = task.status || 'unknown';

    if (mode === 'json') {
      const payload = status === 'completed' ? task.result : { error: task.error, progress: task.progress };
      return `${header}\n\`\`\`json\n${clip(redactSecrets(payload), this.config.output.maxReplyChars)}\n\`\`\``;
    }

    if (status !== 'completed') {
      const error = task.error ? `\n${redactSecrets(task.error)}` : '';
      return `${header}${error}`;
    }

    if (mode === 'silent') return header;

    const summary = mode === 'files'
      ? this.fileOnlySummary(task, files)
      : this.readableSummary(task, files);
    return summary ? `${header}\n${summary}` : header;
  }

  fileOnlySummary(task, files) {
    const names = this.artifactNames(task, files);
    if (names.length) return `Attached: ${names.join(', ')}`;
    const output = this.firstPlainOutput(task);
    return output ? clip(redactSecrets(output), this.config.output.maxReplyChars) : 'No file attachment was produced.';
  }

  readableSummary(task, files) {
    const lines = [];
    if (task.result?.summary) lines.push(task.result.summary);

    const names = this.artifactNames(task, files);
    if (names.length) lines.push(`Files: ${names.join(', ')}`);

    const progress = (task.progress || [])
      .filter((step) => step.summary || step.error)
      .slice(0, 6)
      .map((step) => {
        const status = step.error ? 'failed' : step.status;
        return `Step ${step.index} ${step.type} ${status}: ${step.error || step.summary}`;
      });
    lines.push(...progress);

    if (!names.length) {
      const output = this.firstPlainOutput(task);
      if (output) lines.push(clip(redactSecrets(output), this.config.output.maxReplyChars));
    }

    return clip(lines.filter(Boolean).join('\n'), this.config.output.maxReplyChars);
  }

  artifactNames(task, files) {
    const fromFiles = files.map((file) => file.name).filter(Boolean);
    const artifacts = task.artifacts || task.result?.artifacts || [];
    const fromArtifacts = artifacts.map((artifact) => artifact.filename).filter(Boolean);
    return [...new Set([...fromFiles, ...fromArtifacts])];
  }

  firstPlainOutput(task) {
    const steps = task.result?.steps || [];
    for (const step of steps) {
      const result = step.result || {};
      if (result.output) return result.output;
      if (result.reply) return result.reply;
      if (Array.isArray(result.sources) && result.sources.length) {
        return result.sources.map((source) => `${source.title || source.source}: ${source.url || source.text || ''}`).join('\n');
      }
      if (Array.isArray(result.actions)) {
        const action = result.actions.find((item) => item.data);
        if (action) {
          if (!Array.isArray(action.data)) return action.data;
          return action.data
            .map((item) => {
              if (typeof item === 'string') return item;
              if (item && item.text && item.href) return `${item.text}: ${item.href}`;
              return JSON.stringify(item);
            })
            .join('\n');
        }
      }
    }
    return '';
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
    if (!message || message.author.bot) return;

    // Ignore messages that ping everyone
    if (message.mentions && message.mentions.everyone) return;

    // If message starts with prefix => command handling (existing behavior)
    if (message.content.startsWith(this.brand.prefix)) {
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
      return;
    }

    // Non-prefix messages: respond when bot is mentioned or called by name
    try {
      const content = message.content || '';

      const calledByName = /\b(tianji)\b/i.test(content) || content.includes('天机');
      const mentioned = message.mentions && message.mentions.has && message.mentions.has(this.client.user);

      if (!mentioned && !calledByName) return;

      // Ensure OpenRouter and memory are available
      if (!this.openrouter || !this.userMemory) return;

      // Typing indicator
      await message.channel.sendTyping().catch(() => {});

      const userId = message.author.id;
      const userMem = this.userMemory.load(userId);
      const conversationHistory = (userMem.conversationHistory || []).map(m => ({ role: m.role, content: m.content }));

      // Record the incoming message
      this.userMemory.recordInteraction(userId, { type: 'message', content: content });
      this.userMemory.addMessage(userId, 'user', content);

      // Call OpenRouter (non-streaming)
      const reply = await this.openrouter.chat(content, conversationHistory);

      // Save assistant reply
      this.userMemory.addMessage(userId, 'assistant', reply);

      // Reply with plain text
      await message.reply({ content: reply }).catch(() => {});
    } catch (err) {
      console.error('Auto-reply error:', err);
      try { await message.reply({ content: `Error: ${err.message}` }); } catch {};
    }
  }

  /**
   * Traite les interactions slash commands
   * @param {Interaction} interaction 
   */
  async handleInteraction(interaction) {
    if (!this.interactionHandler) return;
    try {
      await this.interactionHandler.handle(interaction);
    } catch (error) {
      console.error('Interaction handler error:', error);
    }
  }

  /**
   * Traite les réponses/replies aux messages du bot
   * @param {Message} message - Message utilisateur (réponse)
   * @param {Message} repliedTo - Message auquel il est répondu (message du bot)
   */
  async handleReply(message, repliedTo) {
    if (!this.openrouter || !this.userMemory) return;

    try {
      const lang = this.userMemory.load(message.author.id)?.profile?.language || "en";

      // Vérifier si l'utilisateur est autorisé
      if (this.authManager) {
        const permCheck = this.authManager.checkUserPermission(
          message.author,
          message.member,
          message.channel,
          message.guild
        );
        if (!permCheck.allowed) {
          const embed = this.embedBuilder.createUnauthorizedEmbed(lang);
          return await message.reply({ embeds: [embed] });
        }
      }

      // Obtenir l'historique de conversation
      const userMem = this.userMemory.load(message.author.id);
      const conversationHistory = userMem.conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })) || [];

      // Ajouter le message précédent du bot comme contexte
      conversationHistory.push({
        role: "assistant",
        content: repliedTo.content
      });

      // Enregistrer l'interaction
      this.userMemory.recordInteraction(message.author.id, {
        type: "reply",
        content: message.content
      });

      // Montrer le typing
      await message.channel.sendTyping();

      // Appeler OpenRouter
      const response = await this.openrouter.chat(message.content, conversationHistory);

      // Sauvegarder l'échange
      this.userMemory.addMessage(message.author.id, "user", message.content);
      this.userMemory.addMessage(message.author.id, "assistant", response);

      // Répondre en texte simple (pas d'embed)
      return await message.reply({ content: response });
    } catch (error) {
      console.error("Reply error:", error);
      const lang = this.userMemory?.load(message.author.id)?.profile?.language || "en";
      return await message.reply({ content: `Error: ${error.message}` }).catch(() => {});
    }
  }
}

module.exports = DiscordHandler;
