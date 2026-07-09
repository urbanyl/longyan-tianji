const EventEmitter = require('events');
const { clip, formatMs, id, sleep, stringify } = require('./utils');

class Orchestrator extends EventEmitter {
  constructor({ config, memory, browser, codeRunner, fileGenerator, research, planner }) {
    super();
    this.config = config;
    this.memory = memory;
    this.browser = browser;
    this.codeRunner = codeRunner;
    this.fileGenerator = fileGenerator;
    this.research = research;
    this.planner = planner;
    this.activeTasks = new Map();
    this.taskQueue = [];
    this.closed = false;
  }

  async execute(command, context = {}) {
    const cleanCommand = String(command || '').trim();
    if (!cleanCommand) throw new Error('Command is empty.');
    if (cleanCommand.length > this.config.execution.maxCommandChars) {
      throw new Error(`Command is too long. Limit: ${this.config.execution.maxCommandChars} characters.`);
    }
    if (this.taskQueue.length >= this.config.execution.maxQueueSize) {
      throw new Error(`Task queue is full. Limit: ${this.config.execution.maxQueueSize}.`);
    }
    if (context.userId && this.queuedCountForUser(context.userId) >= this.config.execution.maxQueuedTasksPerUser) {
      throw new Error(`Too many queued tasks for this user. Limit: ${this.config.execution.maxQueuedTasksPerUser}.`);
    }

    const task = {
      id: id(),
      sessionId: context.sessionId || id(),
      userId: context.userId || null,
      channelId: context.channelId || null,
      guildId: context.guildId || null,
      command: cleanCommand,
      plan: null,
      progress: [],
      artifacts: [],
      result: null,
      error: null,
      status: 'pending',
      createdAt: Date.now(),
      completedAt: null,
      duration: null,
      cancelled: false
    };

    task.plan = this.planner.plan(task.command);
    if (task.plan.steps.length > this.config.execution.maxPlanSteps) {
      throw new Error(`Too many execution steps. Limit: ${this.config.execution.maxPlanSteps}.`);
    }

    this.taskQueue.push(task);
    this.emit('taskQueued', task);
    this.processQueue();
    return task;
  }

  queuedCountForUser(userId) {
    const queued = this.taskQueue.filter((task) => task.userId === userId).length;
    const active = [...this.activeTasks.values()].filter((task) => task.userId === userId).length;
    return queued + active;
  }

  processQueue() {
    if (this.closed) return;

    while (this.taskQueue.length && this.activeTasks.size < this.config.execution.maxConcurrentTasks) {
      const task = this.taskQueue.shift();
      this.activeTasks.set(task.id, task);
      this.runTask(task)
        .catch((error) => {
          task.error = error.message;
          task.status = task.cancelled ? 'cancelled' : 'failed';
        })
        .finally(async () => {
          task.completedAt = Date.now();
          task.duration = task.completedAt - task.createdAt;
          this.activeTasks.delete(task.id);
          await this.memory.saveTask(task).catch((error) => this.emit('memoryError', error));
          await this.fileGenerator.pruneExpired().catch(() => {});
          this.emit(task.status === 'completed' ? 'taskCompleted' : 'taskFailed', task);
          this.processQueue();
        });
    }
  }

  async runTask(task) {
    task.status = 'running';
    this.emit('taskStarted', task);

    try {
      await Promise.race([
        this.executePlan(task),
        sleep(this.config.execution.taskTimeoutMs).then(() => {
          task.cancelled = true;
          throw new Error(`Task timed out after ${formatMs(this.config.execution.taskTimeoutMs)}`);
        })
      ]);
    } catch (error) {
      if (task.cancelled) {
        await Promise.all([
          this.browser.cancelTask(task.id).catch(() => {}),
          this.codeRunner.cancelTask(task.id).catch(() => {})
        ]);
      }
      throw error;
    }
  }

  async executePlan(task) {
    const steps = [];

    for (const step of task.plan.steps) {
      if (task.cancelled) throw new Error('Task cancelled');

      const startedAt = Date.now();
      const progress = {
        index: step.index,
        type: step.type,
        status: 'running',
        startedAt
      };

      task.progress.push(progress);

      try {
        const result = await this.executeStep(step, task);
        if (task.cancelled) throw new Error('Task cancelled');
        progress.status = 'completed';
        progress.duration = Date.now() - startedAt;
        progress.summary = this.summary(result);
        steps.push({ step: step.index, type: step.type, result });
      } catch (error) {
        progress.status = 'failed';
        progress.duration = Date.now() - startedAt;
        progress.error = error.message;
        throw error;
      }
    }

    task.result = {
      summary: `${steps.length} step${steps.length === 1 ? '' : 's'} completed`,
      steps,
      artifacts: task.artifacts
    };
    task.status = 'completed';
  }

  async executeStep(step, task) {
    if (step.type === 'browser') return await this.browserStep(step, task);
    if (step.type === 'code') return await this.codeRunner.run(step.input, { taskId: task.id });
    if (step.type === 'file') return await this.fileStep(step, task);
    if (step.type === 'research') return await this.research.search(step.input.query);
    const profile = await this.getProfile(task.userId || task.sessionId);
    return {
      project: this.config.brand.project,
      bot: profile.botName,
      user: profile.userName || task.userId || 'user',
      speakingStyle: profile.speakingStyle,
      personality: profile.personality,
      preferences: profile.preferences,
      received: step.input.text,
      reply: this.composePersonalReply(step.input.text, profile)
    };
  }

  composePersonalReply(text, profile) {
    const bot = profile.botName || this.config.brand.bot;
    const user = profile.userName || 'there';
    const style = profile.speakingStyle || this.config.assistant.defaultSpeakingStyle;
    return `${bot} heard you, ${user}. I will answer in this style: ${style}. Message received: ${text}`;
  }

  async browserStep(step, task) {
    const result = await this.browser.execute(step.input, { taskId: task.id });

    if (result.screenshot) {
      const artifact = await this.fileGenerator.saveBuffer(result.screenshot, 'png', {
        name: `${this.config.brand.bot}-screenshot`,
        type: 'screenshot'
      });
      task.artifacts.push(artifact);
      result.screenshot = artifact;
    }

    return result;
  }

  async fileStep(step, task) {
    const input = step.input;
    const output = [];
    const content = input.content || input.data || `${this.config.brand.bot} file payload`;

    if (input.pdf) output.push(await this.fileGenerator.generatePDF(content, { title: input.title, name: input.name }));
    if (input.excel) output.push(await this.fileGenerator.generateExcel(input.data || [{ value: content }], { name: input.name }));
    if (input.image) output.push(await this.fileGenerator.generateImage(input.content || input.title || content, { title: input.content || input.title, name: input.name }));
    if (input.jsonFile) output.push(await this.fileGenerator.writeJSON(input.data || { content }, { name: input.name }));

    for (const artifact of output) task.artifacts.push(artifact);
    return { files: output };
  }

  summary(result) {
    if (!result) return '';
    if (result.files) return `${result.files.length} file${result.files.length === 1 ? '' : 's'}`;
    if (result.output) return clip(result.output, 120);
    if (result.actions) return result.actions.map((action) => action.action).join(', ');
    if (result.sources) return result.sources.map((source) => source.source).join(', ');
    return clip(stringify(result), 120);
  }

  async getStatus(taskId) {
    const active = this.activeTasks.get(taskId);
    if (active) return { ...active, active: true };
    const queued = this.taskQueue.find((task) => task.id === taskId);
    if (queued) return { ...queued, queued: true };
    return await this.memory.getTask(taskId);
  }

  async waitForTask(taskId, timeoutMs) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const task = await this.getStatus(taskId);
      if (task && ['completed', 'failed', 'cancelled'].includes(task.status)) return task;
      await sleep(750);
    }

    return await this.getStatus(taskId);
  }

  async getSession(sessionId) {
    return await this.memory.getTasksBySession(sessionId);
  }

  async getProfile(userId = 'local-user') {
    const profile = await this.memory.getProfile(userId);
    return {
      ...profile,
      botName: profile.botName || this.config.assistant.defaultBotName,
      userName: profile.userName || this.config.assistant.defaultUserName,
      speakingStyle: profile.speakingStyle || this.config.assistant.defaultSpeakingStyle,
      personality: profile.personality || this.config.assistant.defaultPersonality
    };
  }

  async updateProfile(userId, patch) {
    const clean = { ...patch };
    if (clean.notes && clean.notes.length > this.config.assistant.maxProfileNotesChars) {
      throw new Error(`Profile notes are too long. Limit: ${this.config.assistant.maxProfileNotesChars} characters.`);
    }
    return await this.memory.updateProfile(userId, clean);
  }

  async rememberPreference(userId, key, value) {
    const cleanKey = String(key || '').trim();
    const cleanValue = String(value || '').trim();
    if (!cleanKey) throw new Error('Preference key is required.');
    if (cleanKey.includes(':')) throw new Error('Preference keys cannot contain colon characters.');
    if (cleanValue.length > this.config.assistant.maxPreferenceValueChars) {
      throw new Error(`Preference value is too long. Limit: ${this.config.assistant.maxPreferenceValueChars} characters.`);
    }
    return await this.memory.rememberPreference(userId, cleanKey, cleanValue);
  }

  async forgetPreference(userId, key) {
    const cleanKey = String(key || '').trim();
    if (!cleanKey) throw new Error('Preference key is required.');
    return await this.memory.forgetPreference(userId, cleanKey);
  }

  queueState() {
    return {
      active: [...this.activeTasks.values()].map((task) => ({
        id: task.id,
        status: task.status,
        command: task.command,
        ageMs: Date.now() - task.createdAt
      })),
      queued: this.taskQueue.map((task) => ({
        id: task.id,
        status: task.status,
        command: task.command,
        ageMs: Date.now() - task.createdAt
      }))
    };
  }

  async cancelTask(taskId) {
    const active = this.activeTasks.get(taskId);
    if (active) {
      active.cancelled = true;
      active.status = 'cancelled';
      active.completedAt = Date.now();
      await Promise.all([
        this.browser.cancelTask(taskId).catch(() => {}),
        this.codeRunner.cancelTask(taskId).catch(() => {})
      ]);
      await this.memory.saveTask(active).catch(() => {});
      return active;
    }

    const index = this.taskQueue.findIndex((task) => task.id === taskId);
    if (index === -1) return null;

    const [task] = this.taskQueue.splice(index, 1);
    task.cancelled = true;
    task.status = 'cancelled';
    task.completedAt = Date.now();
    await this.memory.saveTask(task).catch(() => {});
    return task;
  }

  async health() {
    const [memory, docker, browser] = await Promise.all([
      this.memory.stats(),
      this.codeRunner.health(),
      this.browser.health().catch((error) => ({ browser: false, error: error.message }))
    ]);

    return {
      memory,
      docker,
      browser,
      queue: this.queueState()
    };
  }

  async shutdown() {
    this.closed = true;
    const active = [...this.activeTasks.values()];

    for (const task of active) {
      task.cancelled = true;
      task.status = 'shutdown';
      task.completedAt = Date.now();
    }

    this.taskQueue = [];
    this.activeTasks.clear();
    await Promise.all([
      ...active.map((task) => this.browser.cancelTask(task.id).catch(() => {})),
      ...active.map((task) => this.codeRunner.cancelTask(task.id).catch(() => {}))
    ]);
    await this.browser.close().catch(() => {});
    this.codeRunner.cleanup();
    await this.fileGenerator.cleanup().catch(() => {});
    this.memory.close();
  }
}

module.exports = Orchestrator;
