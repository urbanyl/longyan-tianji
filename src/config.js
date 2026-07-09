const path = require('path');
require('dotenv').config();

const rootDir = path.resolve(__dirname, '..');

function text(name, fallback = '') {
  const value = process.env[name];
  return value == null || value === '' ? fallback : value;
}

function integer(name, fallback, minimum = 0) {
  const value = Number.parseInt(process.env[name], 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(minimum, value);
}

function boolean(name, fallback = false) {
  const value = process.env[name];
  if (value == null || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(value);
}

module.exports = Object.freeze({
  rootDir,
  brand: Object.freeze({
    project: text('PROJECT_NAME', 'Longyan'),
    bot: text('BOT_NAME', 'Tianji'),
    prefix: text('COMMAND_PREFIX', '!')
  }),
  discord: Object.freeze({
    token: text('DISCORD_TOKEN'),
    clientId: text('DISCORD_CLIENT_ID')
  }),
  execution: Object.freeze({
    maxConcurrentTasks: integer('MAX_CONCURRENT_TASKS', 10, 1),
    taskTimeoutMs: integer('TASK_TIMEOUT_MS', 120000, 1000),
    replyWaitMs: integer('REPLY_WAIT_MS', 60000, 1000),
    codeTimeoutMs: integer('CODE_TIMEOUT_MS', 30000, 1000),
    memoryPath: path.resolve(rootDir, text('MEMORY_DB_PATH', './longyan-memory.db'))
  }),
  docker: Object.freeze({
    socketPath: text('DOCKER_SOCKET', '/var/run/docker.sock'),
    networkMode: text('DOCKER_NETWORK', 'none'),
    autoPullImages: boolean('AUTO_PULL_IMAGES', true),
    pythonImage: text('PYTHON_IMAGE', 'python:3.11-slim'),
    nodeImage: text('NODE_IMAGE', 'node:20-slim')
  }),
  browser: Object.freeze({
    headless: boolean('BROWSER_HEADLESS', true),
    timeoutMs: integer('BROWSER_TIMEOUT_MS', 45000, 1000),
    viewport: Object.freeze({
      width: integer('BROWSER_WIDTH', 1920, 320),
      height: integer('BROWSER_HEIGHT', 1080, 240)
    })
  }),
  output: Object.freeze({
    tempDir: path.resolve(rootDir, text('TEMP_DIR', './temp')),
    maxReplyChars: integer('MAX_REPLY_CHARS', 1800, 500),
    maxAttachmentFiles: integer('MAX_ATTACHMENT_FILES', 8, 1)
  }),
  research: Object.freeze({
    serpApiKey: text('SERPAPI_KEY')
  })
});
