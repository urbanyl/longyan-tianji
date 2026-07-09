const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const playwright = require('playwright');
const Docker = require('dockerode');
const PDFDocument = require('pdfkit');
const XLSX = require('xlsx');
const sharp = require('sharp');
const sqlite3 = require('sqlite3').verbose();
const { promises: fs, createWriteStream } = require('fs');
const path = require('path');
const axios = require('axios');
const EventEmitter = require('events');
require('dotenv').config();

const brand = Object.freeze({
  project: process.env.PROJECT_NAME || 'Longyan',
  bot: process.env.BOT_NAME || 'Tianji',
  founder: process.env.FOUNDER_NAME || 'Yu Cheng',
  alias: process.env.FOUNDER_ALIAS || 'Urbanyl 1920',
  prefix: process.env.COMMAND_PREFIX || '!'
});

const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function clip(value, limit = 1900) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function parseJson(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeUrl(value) {
  if (!value) return null;
  const clean = value.replace(/[)>.,]+$/g, '');
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
}

function decodeDockerLog(buffer) {
  if (!Buffer.isBuffer(buffer)) return String(buffer || '');
  const chunks = [];
  let offset = 0;
  while (offset + 8 <= buffer.length) {
    const size = buffer.readUInt32BE(offset + 4);
    const start = offset + 8;
    const end = start + size;
    if (end > buffer.length) break;
    chunks.push(buffer.slice(start, end));
    offset = end;
  }
  return chunks.length ? Buffer.concat(chunks).toString('utf8') : buffer.toString('utf8');
}

class MemoryManager {
  constructor(dbPath) {
    this.db = new sqlite3.Database(dbPath);
    this.ready = this.init();
  }

  async init() {
    await this.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        command TEXT,
        result TEXT,
        error TEXT,
        status TEXT,
        duration INTEGER,
        created_at INTEGER,
        completed_at INTEGER
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS memory (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at INTEGER
      )
    `);
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function onRun(error) {
        if (error) reject(error);
        else resolve(this);
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (error, row) => {
        if (error) reject(error);
        else resolve(row || null);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (error, rows) => {
        if (error) reject(error);
        else resolve(rows || []);
      });
    });
  }

  async saveTask(task) {
    await this.ready;
    await this.run(
      `INSERT OR REPLACE INTO tasks (id, session_id, command, result, error, status, duration, created_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.sessionId,
        task.command,
        JSON.stringify(task.result),
        task.error,
        task.status,
        task.duration || null,
        task.createdAt,
        task.completedAt || null
      ]
    );
  }

  async getTask(id) {
    await this.ready;
    const row = await this.get('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!row) return null;
    return {
      id: row.id,
      sessionId: row.session_id,
      command: row.command,
      result: parseJson(row.result),
      error: row.error,
      status: row.status,
      duration: row.duration,
      createdAt: row.created_at,
      completedAt: row.completed_at
    };
  }

  async getTasksBySession(sessionId, limit = 20) {
    await this.ready;
    const rows = await this.all(
      'SELECT * FROM tasks WHERE session_id = ? ORDER BY created_at DESC LIMIT ?',
      [sessionId, limit]
    );
    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      command: row.command,
      result: parseJson(row.result),
      error: row.error,
      status: row.status,
      duration: row.duration,
      createdAt: row.created_at,
      completedAt: row.completed_at
    }));
  }

  async setMemory(key, value) {
    await this.ready;
    await this.run(
      'INSERT OR REPLACE INTO memory (key, value, updated_at) VALUES (?, ?, ?)',
      [key, JSON.stringify(value), Date.now()]
    );
  }

  async getMemory(key) {
    await this.ready;
    const row = await this.get('SELECT value FROM memory WHERE key = ?', [key]);
    return row ? parseJson(row.value, row.value) : null;
  }

  close() {
    this.db.close();
  }
}

class BrowserAgent {
  constructor(options = {}) {
    this.options = options;
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async init() {
    if (this.page) return this;

    this.browser = await playwright.chromium.launch({
      headless: this.options.headless !== false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.context = await this.browser.newContext({
      viewport: this.options.viewport || { width: 1920, height: 1080 },
      userAgent: `${brand.project}/${brand.bot} by ${brand.alias}`
    });

    this.page = await this.context.newPage();
    return this;
  }

  async navigate(url) {
    await this.init();
    await this.page.goto(normalizeUrl(url), { waitUntil: 'networkidle', timeout: 60000 });
    return await this.page.title();
  }

  async click(selector) {
    await this.init();
    await this.page.waitForSelector(selector, { timeout: 15000 });
    await this.page.click(selector);
    return { clicked: selector };
  }

  async type(selector, text) {
    await this.init();
    await this.page.waitForSelector(selector, { timeout: 15000 });
    await this.page.fill(selector, text);
    return { typed: selector };
  }

  async screenshot() {
    await this.init();
    return await this.page.screenshot({ fullPage: true });
  }

  async scrape(selector) {
    await this.init();
    await this.page.waitForSelector(selector, { timeout: 15000 });
    return await this.page.$$eval(selector, (elements) =>
      elements.map((element) => element.textContent.trim()).filter(Boolean)
    );
  }

  async evaluate(script) {
    await this.init();
    return await this.page.evaluate(script);
  }

  async close() {
    if (this.browser) await this.browser.close();
    this.browser = null;
    this.context = null;
    this.page = null;
  }
}

class CodeRunner {
  constructor(options = {}) {
    this.options = options;
    this.containers = new Map();
    this.timeout = Number(options.timeout || process.env.CODE_TIMEOUT_MS || 30000);
  }

  async run(code, language = 'python') {
    const containerId = uuidv4();
    const image = language === 'javascript' ? 'node:20-slim' : 'python:3.11-slim';
    const command = language === 'javascript' ? ['node', '-e', code] : ['python', '-c', code];
    let container = null;

    try {
      container = await docker.createContainer({
        Image: image,
        Cmd: command,
        WorkingDir: '/app',
        HostConfig: {
          Memory: 512 * 1024 * 1024,
          MemorySwap: 512 * 1024 * 1024,
          CpuPeriod: 100000,
          CpuQuota: 50000,
          NetworkMode: 'none',
          ReadonlyRootfs: true
        }
      });

      this.containers.set(containerId, container);
      await container.start();

      const outcome = await Promise.race([
        container.wait(),
        delay(this.timeout).then(() => ({ StatusCode: 124, timedOut: true }))
      ]);

      if (outcome.timedOut) {
        await container.kill().catch(() => {});
      }

      const logs = await container.logs({ stdout: true, stderr: true });
      return {
        containerId,
        language,
        exitCode: outcome.StatusCode,
        timedOut: Boolean(outcome.timedOut),
        output: decodeDockerLog(logs).trim()
      };
    } catch (error) {
      return { containerId, language, error: error.message };
    } finally {
      if (container) {
        await container.remove({ force: true }).catch(() => {});
      }
      this.containers.delete(containerId);
    }
  }

  cleanup() {
    for (const container of this.containers.values()) {
      container.remove({ force: true }).catch(() => {});
    }
    this.containers.clear();
  }
}

class FileGenerator {
  constructor() {
    this.tempDir = path.join(__dirname, 'temp');
    this.ready = fs.mkdir(this.tempDir, { recursive: true });
  }

  async generatePDF(content, options = {}) {
    await this.ready;
    const filename = `${brand.bot.toLowerCase()}_${Date.now()}.pdf`;
    const filepath = path.join(this.tempDir, filename);

    await new Promise((resolve, reject) => {
      const doc = new PDFDocument(options);
      const stream = createWriteStream(filepath);
      doc.pipe(stream);

      if (typeof content === 'string') {
        doc.fontSize(18).text(`${brand.project} Report`, { underline: true });
        doc.moveDown();
        doc.fontSize(11).text(content);
      } else if (Array.isArray(content)) {
        for (const item of content) {
          if (item.title) doc.fontSize(18).text(item.title);
          if (item.text) doc.fontSize(11).text(item.text);
          doc.moveDown();
        }
      }

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    return { filename, filepath };
  }

  async generateExcel(data, options = {}) {
    await this.ready;
    const filename = `${brand.bot.toLowerCase()}_${Date.now()}.xlsx`;
    const filepath = path.join(this.tempDir, filename);
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(Array.isArray(data) ? data : [data]);
    XLSX.utils.book_append_sheet(workbook, worksheet, options.sheetName || brand.bot);
    XLSX.writeFile(workbook, filepath);
    return { filename, filepath };
  }

  async generateImage(data, format = 'png') {
    await this.ready;
    const filename = `${brand.bot.toLowerCase()}_${Date.now()}.${format}`;
    const filepath = path.join(this.tempDir, filename);
    const input = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
    let pipeline = sharp(input);

    if (format === 'jpeg' || format === 'jpg') pipeline = pipeline.jpeg({ quality: 92 });
    if (format === 'png') pipeline = pipeline.png();
    if (format === 'webp') pipeline = pipeline.webp();

    await pipeline.toFile(filepath);
    return { filename, filepath };
  }

  async cleanup() {
    await this.ready;
    const files = await fs.readdir(this.tempDir).catch(() => []);
    await Promise.all(files.map((file) => fs.unlink(path.join(this.tempDir, file)).catch(() => {})));
  }
}

class Orchestrator extends EventEmitter {
  constructor({ memory, browser, codeRunner, fileGenerator, maxTasks }) {
    super();
    this.memory = memory;
    this.browser = browser;
    this.codeRunner = codeRunner;
    this.fileGenerator = fileGenerator;
    this.maxTasks = maxTasks || 10;
    this.activeTasks = new Map();
    this.taskQueue = [];
  }

  async execute(command, context = {}) {
    const task = {
      id: uuidv4(),
      sessionId: context.sessionId || uuidv4(),
      command,
      context,
      status: 'pending',
      createdAt: Date.now(),
      completedAt: null,
      duration: null,
      result: null,
      error: null
    };

    this.taskQueue.push(task);
    this.emit('taskQueued', task);
    this.processQueue();
    return task;
  }

  processQueue() {
    while (this.taskQueue.length && this.activeTasks.size < this.maxTasks) {
      const task = this.taskQueue.shift();
      this.activeTasks.set(task.id, task);
      this.executeTask(task)
        .catch((error) => {
          task.error = error.message;
          task.status = 'failed';
          this.emit('taskFailed', task);
        })
        .finally(async () => {
          this.activeTasks.delete(task.id);
          await this.memory.saveTask(task).catch(() => {});
          this.processQueue();
        });
    }
  }

  parseCommand(command) {
    const chunks = command.split(/\s+(?:then|and then|puis|ensuite)\s+|;\s*/i).filter(Boolean);
    return chunks.map((chunk) => {
      const lower = chunk.toLowerCase();
      let type = 'general';

      if (/(https?:\/\/|go to|open|browse|scrape|selector:|screenshot|click)/i.test(chunk)) type = 'browser';
      if (/(python|javascript|node|code:|```|run code|execute code)/i.test(chunk)) type = 'code';
      if (/(pdf|excel|xlsx|image|report|file|chart)/i.test(chunk)) type = 'file';
      if (/(search|lookup|wikipedia|whois|public web|research)/i.test(chunk) && type === 'general') type = 'research';
      if (/osint/i.test(lower)) type = 'research';

      return { type, original: chunk.trim() };
    });
  }

  async executeTask(task) {
    task.status = 'running';
    this.emit('taskStarted', task);
    const startedAt = Date.now();

    try {
      const commands = this.parseCommand(task.command);
      const results = [];

      for (const command of commands) {
        if (command.type === 'browser') results.push(await this.browserTask(command));
        else if (command.type === 'code') results.push(await this.codeTask(command));
        else if (command.type === 'file') results.push(await this.fileTask(command));
        else if (command.type === 'research') results.push(await this.researchTask(command));
        else results.push(await this.generalTask(command));
      }

      task.result = results.length === 1 ? results[0] : results;
      task.status = 'completed';
      this.emit('taskCompleted', task);
    } catch (error) {
      task.error = error.message;
      task.status = 'failed';
      this.emit('taskFailed', task);
    } finally {
      task.completedAt = Date.now();
      task.duration = task.completedAt - startedAt;
    }
  }

  async browserTask(command) {
    const original = command.original;
    const urlMatch = original.match(/https?:\/\/[^\s]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/i);
    const selectors = [...original.matchAll(/selector:("[^"]+"|'[^']+'|[^\s]+)/gi)].map((match) =>
      match[1].replace(/^['"]|['"]$/g, '')
    );
    const actions = [];

    if (urlMatch) {
      const title = await this.browser.navigate(urlMatch[0]);
      actions.push({ action: 'navigate', url: normalizeUrl(urlMatch[0]), title });
    }

    for (const selector of selectors) {
      if (/click/i.test(original)) actions.push(await this.browser.click(selector));
      else actions.push({ action: 'scrape', selector, data: await this.browser.scrape(selector) });
    }

    if (/screenshot/i.test(original)) {
      const buffer = await this.browser.screenshot();
      const file = await this.fileGenerator.generateImage(buffer);
      actions.push({ action: 'screenshot', file });
    }

    return { browser: actions.length ? actions : [{ action: 'ready', bot: brand.bot }] };
  }

  async codeTask(command) {
    const fenced = command.original.match(/```(?:\w+)?\s*([\s\S]*?)```/);
    const inline = command.original.match(/code:\s*([\s\S]+)/i);
    const code = fenced ? fenced[1].trim() : inline ? inline[1].trim() : '';

    if (!code) {
      return { code: { error: 'No code block or code: payload found.' } };
    }

    const language = /javascript|node|js/i.test(command.original) ? 'javascript' : 'python';
    return { code: await this.codeRunner.run(code, language) };
  }

  async fileTask(command) {
    const original = command.original;
    const results = [];

    if (/pdf|report/i.test(original)) {
      const content = original.match(/content:\s*([\s\S]+)/i);
      const file = await this.fileGenerator.generatePDF(content ? content[1].trim() : `${brand.bot} generated this report.`);
      results.push({ action: 'pdf', file });
    }

    if (/excel|xlsx/i.test(original)) {
      const data = original.match(/data:\s*(\[[\s\S]*\]|\{[\s\S]*\})/i);
      const parsed = data ? parseJson(data[1], [{ status: 'created', bot: brand.bot }]) : [{ status: 'created', bot: brand.bot }];
      const file = await this.fileGenerator.generateExcel(parsed);
      results.push({ action: 'excel', file });
    }

    if (/image/i.test(original)) {
      const text = original.match(/text:\s*([^\n]+)/i);
      const label = text ? text[1].trim() : `${brand.project} ${brand.bot}`;
      const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="#0c111d"/><text x="80" y="285" fill="#f7c948" font-family="Arial" font-size="82" font-weight="700">${label}</text><text x="84" y="360" fill="#d6e4ff" font-family="Arial" font-size="30">Built by ${brand.founder}, ${brand.alias}</text></svg>`;
      const file = await this.fileGenerator.generateImage(svg);
      results.push({ action: 'image', file });
    }

    return { file: results };
  }

  async researchTask(command) {
    const query = command.original
      .replace(/\b(osint|search|lookup|wikipedia|whois|public web|research|find)\b/gi, '')
      .trim();
    const target = query || brand.project;
    const results = [];

    if (process.env.SERPAPI_KEY) {
      const google = await axios
        .get('https://serpapi.com/search.json', {
          params: { q: target, api_key: process.env.SERPAPI_KEY }
        })
        .then((response) =>
          (response.data.organic_results || []).slice(0, 5).map((item) => ({
            title: item.title,
            link: item.link,
            snippet: item.snippet
          }))
        )
        .catch((error) => ({ error: error.message }));
      results.push({ source: 'serpapi', data: google });
    }

    const wikipedia = await axios
      .get('https://en.wikipedia.org/w/api.php', {
        params: { action: 'query', list: 'search', srsearch: target, format: 'json' }
      })
      .then((response) =>
        response.data.query.search.slice(0, 5).map((item) => ({
          title: item.title,
          snippet: item.snippet.replace(/<[^>]+>/g, '')
        }))
      )
      .catch((error) => ({ error: error.message }));

    results.push({ source: 'wikipedia', data: wikipedia });
    return { research: { query: target, results } };
  }

  async generalTask(command) {
    return {
      general: {
        project: brand.project,
        bot: brand.bot,
        founder: `${brand.founder}, ${brand.alias}`,
        message: `${brand.bot} received: ${command.original}`
      }
    };
  }

  async getStatus(taskId) {
    const active = this.activeTasks.get(taskId);
    if (active) return { ...active, active: true };
    return await this.memory.getTask(taskId);
  }

  async getSession(sessionId) {
    return await this.memory.getTasksBySession(sessionId);
  }

  async cancelTask(taskId) {
    const active = this.activeTasks.get(taskId);
    if (active) {
      active.status = 'cancelled';
      active.completedAt = Date.now();
      return active;
    }

    const index = this.taskQueue.findIndex((task) => task.id === taskId);
    if (index === -1) return null;

    const [task] = this.taskQueue.splice(index, 1);
    task.status = 'cancelled';
    task.completedAt = Date.now();
    await this.memory.saveTask(task).catch(() => {});
    return task;
  }

  async shutdown() {
    for (const task of this.activeTasks.values()) {
      task.status = 'shutdown';
      task.completedAt = Date.now();
    }

    this.activeTasks.clear();
    this.taskQueue = [];
    await this.browser.close().catch(() => {});
    this.codeRunner.cleanup();
    await this.fileGenerator.cleanup().catch(() => {});
    this.memory.close();
  }
}

class DiscordHandler {
  constructor(client, orchestrator) {
    this.client = client;
    this.orchestrator = orchestrator;
    this.commands = new Map();
    this.setupCommands();
    this.setupEvents();
  }

  setupCommands() {
    this.commands.set('exec', async (message, args) => {
      const command = args.join(' ').trim();
      if (!command) return message.reply(`${brand.bot} is listening. Give me an order after ${brand.prefix}exec.`);

      const task = await this.orchestrator.execute(command, {
        sessionId: message.author.id,
        userId: message.author.id,
        channelId: message.channel.id
      });

      const status = await this.waitForTask(task.id);
      return await this.replyWithTask(message, status);
    });

    this.commands.set('status', async (message, args) => {
      const taskId = args[0];
      if (!taskId) return message.reply('Send a task id.');

      const status = await this.orchestrator.getStatus(taskId);
      if (!status) return message.reply('Task not found.');

      return await this.replyWithTask(message, status);
    });

    this.commands.set('cancel', async (message, args) => {
      const taskId = args[0];
      if (!taskId) return message.reply('Send a task id.');

      const task = await this.orchestrator.cancelTask(taskId);
      return message.reply(task ? `Task ${taskId} cancelled.` : `Task ${taskId} was not found.`);
    });

    this.commands.set('memory', async (message, args) => {
      const action = args[0];
      const key = args[1] && /^(get|set)$/i.test(action) ? args[1] : action;
      const valueStart = /^(get|set)$/i.test(action) ? 2 : 1;

      if (!key) return message.reply(`Usage: ${brand.prefix}memory key value or ${brand.prefix}memory get key`);

      if (/^get$/i.test(action) || args.length === 1) {
        const value = await this.orchestrator.memory.getMemory(key);
        return message.reply(`Memory ${key}: ${clip(value ?? 'empty', 1500)}`);
      }

      const value = args.slice(valueStart).join(' ');
      await this.orchestrator.memory.setMemory(key, value);
      return message.reply(`Memory stored: ${key}`);
    });

    this.commands.set('session', async (message, args) => {
      const sessionId = args[0] || message.author.id;
      const tasks = await this.orchestrator.getSession(sessionId);

      if (!tasks.length) return message.reply('No tasks found for this session.');

      const lines = tasks
        .slice(0, 10)
        .map((task) => `${task.status} ${task.id.slice(0, 8)} ${clip(task.command, 70)}`)
        .join('\n');

      return message.reply(`Session ${sessionId}\n\`\`\`\n${lines}\n\`\`\``);
    });

    this.commands.set('name', async (message) => {
      return message.reply(
        `${brand.project} is pronounced "Long Yan". ${brand.bot} is pronounced "Tian Ji". Built by ${brand.founder}, ${brand.alias}.`
      );
    });
  }

  setupEvents() {
    this.orchestrator.on('taskCompleted', (task) => {
      console.log(`${brand.bot} completed ${task.id} in ${task.duration}ms`);
    });

    this.orchestrator.on('taskFailed', (task) => {
      console.error(`${brand.bot} failed ${task.id}: ${task.error}`);
    });
  }

  async waitForTask(taskId, timeout = 60000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeout) {
      const status = await this.orchestrator.getStatus(taskId);
      if (status && ['completed', 'failed', 'cancelled'].includes(status.status)) return status;
      await delay(1000);
    }

    return { id: taskId, status: 'running', result: 'Task is still running. Use status later.' };
  }

  async replyWithTask(message, status) {
    const files = this.extractFiles(status.result);
    const body =
      status.status === 'completed'
        ? `${brand.bot} completed ${status.id || 'the task'} in ${status.duration || 0}ms\n\`\`\`json\n${clip(status.result)}\n\`\`\``
        : `${brand.bot} status: ${status.status}\n${status.error ? `Error: ${status.error}` : clip(status.result || '')}`;

    return message.reply({ content: clip(body, 2000), files });
  }

  extractFiles(value) {
    const files = [];
    const visit = (item) => {
      if (!item || typeof item !== 'object') return;
      if (item.filepath) files.push({ attachment: item.filepath, name: item.filename || path.basename(item.filepath) });
      if (Array.isArray(item)) item.forEach(visit);
      else Object.values(item).forEach(visit);
    };
    visit(value);
    return files.slice(0, 10);
  }

  async handleMessage(message) {
    if (message.author.bot || !message.content.startsWith(brand.prefix)) return;

    const [commandName, ...args] = message.content.slice(brand.prefix.length).trim().split(/\s+/);
    const command = this.commands.get((commandName || '').toLowerCase());
    if (!command) return;

    try {
      await command(message, args);
    } catch (error) {
      await message.reply(`${brand.bot} error: ${error.message}`);
    }
  }
}

async function ensureRuntimeImages() {
  await docker.getImage('python:3.11-slim').inspect().catch(() => null);
  await docker.getImage('node:20-slim').inspect().catch(() => null);
}

const memory = new MemoryManager(process.env.MEMORY_DB_PATH || './longyan-memory.db');
const browser = new BrowserAgent({ headless: process.env.BROWSER_HEADLESS !== 'false' });
const codeRunner = new CodeRunner({});
const fileGenerator = new FileGenerator();

const orchestrator = new Orchestrator({
  memory,
  browser,
  codeRunner,
  fileGenerator,
  maxTasks: Number(process.env.MAX_CONCURRENT_TASKS || 10)
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel, Partials.Message]
});

const handler = new DiscordHandler(client, orchestrator);

client.once('ready', async () => {
  console.log(`${brand.project} ${brand.bot} is online as ${client.user.tag}`);
  await ensureRuntimeImages();
});

client.on('messageCreate', async (message) => {
  await handler.handleMessage(message);
});

process.on('SIGINT', async () => {
  console.log(`${brand.bot} shutting down.`);
  await orchestrator.shutdown();
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  console.error(`${brand.bot} unhandled rejection:`, error);
});

client.login(process.env.DISCORD_TOKEN);
