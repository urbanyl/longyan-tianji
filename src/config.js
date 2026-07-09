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

function list(name) {
  return text(name)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function choice(name, fallback, values) {
  const value = text(name, fallback).toLowerCase();
  return values.includes(value) ? value : fallback;
}

function boundedInteger(name, fallback, minimum, maximum) {
  return Math.min(integer(name, fallback, minimum), maximum);
}

function dockerSocket() {
  const value = text('DOCKER_SOCKET');
  if (process.platform === 'win32' && (!value || value === '/var/run/docker.sock')) {
    return '//./pipe/docker_engine';
  }
  return value || '/var/run/docker.sock';
}

function inside(base, target) {
  const relative = path.relative(base, target);
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function safePath(name, fallback, allowOutsideName) {
  const resolved = path.resolve(rootDir, text(name, fallback));
  if (!boolean(allowOutsideName, false) && !inside(rootDir, resolved)) {
    throw new Error(`${name} must stay inside ${rootDir}. Set ${allowOutsideName}=true only for a reviewed deployment.`);
  }
  return resolved;
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
    maxConcurrentTasks: boundedInteger('MAX_CONCURRENT_TASKS', 4, 1, 25),
    maxQueueSize: boundedInteger('MAX_QUEUE_SIZE', 50, 1, 1000),
    maxQueuedTasksPerUser: boundedInteger('MAX_QUEUED_TASKS_PER_USER', 3, 1, 100),
    maxCommandChars: boundedInteger('MAX_COMMAND_CHARS', 6000, 50, 50000),
    maxPlanSteps: boundedInteger('MAX_PLAN_STEPS', 6, 1, 25),
    taskTimeoutMs: integer('TASK_TIMEOUT_MS', 120000, 1000),
    replyWaitMs: integer('REPLY_WAIT_MS', 60000, 1000),
    codeTimeoutMs: integer('CODE_TIMEOUT_MS', 30000, 1000),
    codeMaxChars: boundedInteger('CODE_MAX_CHARS', 12000, 1, 100000),
    codeMaxOutputChars: boundedInteger('CODE_MAX_OUTPUT_CHARS', 12000, 100, 200000),
    memoryPath: safePath('MEMORY_DB_PATH', './longyan-memory.db', 'ALLOW_MEMORY_DB_OUTSIDE_ROOT')
  }),
  docker: Object.freeze({
    socketPath: dockerSocket(),
    networkMode: text('DOCKER_NETWORK', 'none'),
    autoPullImages: boolean('AUTO_PULL_IMAGES', false),
    pythonImage: text('PYTHON_IMAGE', 'python:3.11-slim'),
    nodeImage: text('NODE_IMAGE', 'node:20-slim'),
    runUser: text('DOCKER_RUN_USER', '1000:1000'),
    memoryMb: boundedInteger('DOCKER_MEMORY_MB', 512, 64, 4096),
    cpuQuota: boundedInteger('DOCKER_CPU_QUOTA', 50000, 1000, 100000),
    pidsLimit: boundedInteger('DOCKER_PIDS_LIMIT', 128, 16, 1024),
    tmpfsSizeMb: boundedInteger('DOCKER_TMPFS_SIZE_MB', 64, 8, 1024),
    readOnlyRootFs: boolean('DOCKER_READONLY_ROOTFS', true),
    capDropAll: boolean('DOCKER_CAP_DROP_ALL', true),
    noNewPrivileges: boolean('DOCKER_NO_NEW_PRIVILEGES', true)
  }),
  browser: Object.freeze({
    headless: boolean('BROWSER_HEADLESS', true),
    disableSandbox: boolean('BROWSER_DISABLE_SANDBOX', false),
    allowEval: boolean('BROWSER_ALLOW_EVAL', false),
    allowPrivateNetworks: boolean('BROWSER_ALLOW_PRIVATE_NETWORKS', false),
    allowedHosts: list('BROWSER_ALLOWED_HOSTS'),
    blockedHosts: list('BROWSER_BLOCKED_HOSTS'),
    timeoutMs: integer('BROWSER_TIMEOUT_MS', 45000, 1000),
    maxTextChars: boundedInteger('BROWSER_MAX_TEXT_CHARS', 4000, 100, 50000),
    maxLinks: boundedInteger('BROWSER_MAX_LINKS', 20, 1, 250),
    maxScreenshotBytes: boundedInteger('BROWSER_MAX_SCREENSHOT_BYTES', 8 * 1024 * 1024, 1024, 50 * 1024 * 1024),
    fullPageScreenshots: boolean('BROWSER_FULL_PAGE_SCREENSHOTS', false),
    viewport: Object.freeze({
      width: integer('BROWSER_WIDTH', 1920, 320),
      height: integer('BROWSER_HEIGHT', 1080, 240)
    })
  }),
  output: Object.freeze({
    tempDir: safePath('TEMP_DIR', './temp', 'ALLOW_TEMP_DIR_OUTSIDE_ROOT'),
    defaultReplyMode: choice('DEFAULT_REPLY_MODE', 'summary', ['summary', 'files', 'json', 'silent']),
    maxReplyChars: integer('MAX_REPLY_CHARS', 1800, 500),
    maxAttachmentFiles: boundedInteger('MAX_ATTACHMENT_FILES', 8, 1, 20),
    maxAttachmentBytes: boundedInteger('MAX_ATTACHMENT_BYTES', 8 * 1024 * 1024, 1024, 50 * 1024 * 1024),
    maxFileInputChars: boundedInteger('MAX_FILE_INPUT_CHARS', 100000, 100, 1000000),
    tempFileTtlMs: integer('TEMP_FILE_TTL_MS', 24 * 60 * 60 * 1000, 60000)
  }),
  security: Object.freeze({
    requireAllowlist: boolean('SECURITY_REQUIRE_ALLOWLIST', true),
    allowDirectMessages: boolean('ALLOW_DIRECT_MESSAGES', false),
    allowPublicCommands: boolean('ALLOW_PUBLIC_COMMANDS', true),
    allowedGuildIds: list('ALLOWED_GUILD_IDS'),
    allowedChannelIds: list('ALLOWED_CHANNEL_IDS'),
    allowedUserIds: list('ALLOWED_USER_IDS'),
    allowedRoleIds: list('ALLOWED_ROLE_IDS'),
    adminUserIds: list('ADMIN_USER_IDS'),
    adminRoleIds: list('ADMIN_ROLE_IDS'),
    rateLimitWindowMs: integer('RATE_LIMIT_WINDOW_MS', 60000, 1000),
    rateLimitMaxCommands: boundedInteger('RATE_LIMIT_MAX_COMMANDS', 12, 1, 1000),
    bypassRateLimitForAdmins: boolean('BYPASS_RATE_LIMIT_FOR_ADMINS', true)
  }),
  memory: Object.freeze({
    scope: choice('MEMORY_SCOPE', 'user', ['user', 'channel', 'guild', 'global']),
    maxValueChars: boundedInteger('MEMORY_MAX_VALUE_CHARS', 200000, 1, 1000000),
    listLimit: boundedInteger('MEMORY_LIST_LIMIT', 20, 1, 100)
  }),
  assistant: Object.freeze({
    defaultBotName: text('ASSISTANT_DEFAULT_BOT_NAME', text('BOT_NAME', 'Tianji')),
    defaultUserName: text('ASSISTANT_DEFAULT_USER_NAME'),
    defaultSpeakingStyle: text('ASSISTANT_DEFAULT_SPEAKING_STYLE', 'warm, concise, professional'),
    defaultPersonality: text('ASSISTANT_DEFAULT_PERSONALITY', 'Personal automation assistant with a calm enterprise tone.'),
    maxProfileNotesChars: boundedInteger('ASSISTANT_MAX_PROFILE_NOTES_CHARS', 200000, 0, 1000000),
    maxPreferenceValueChars: boundedInteger('ASSISTANT_MAX_PREFERENCE_VALUE_CHARS', 50000, 1, 200000)
  }),
  research: Object.freeze({
    serpApiKey: text('SERPAPI_KEY'),
    serpApiEnabled: boolean('SERPAPI_ENABLED', false),
    freeSearchEnabled: boolean('FREE_SEARCH_ENABLED', true),
    timeoutMs: integer('RESEARCH_TIMEOUT_MS', 12000, 1000),
    maxResults: boundedInteger('RESEARCH_MAX_RESULTS', 5, 1, 20)
  }),
  localDashboard: Object.freeze({
    enabled: boolean('LOCAL_DASHBOARD_ENABLED', false),
    host: text('LOCAL_DASHBOARD_HOST', '127.0.0.1'),
    port: boundedInteger('LOCAL_DASHBOARD_PORT', 3010, 1, 65535),
    open: boolean('LOCAL_DASHBOARD_OPEN', false),
    token: text('LOCAL_DASHBOARD_TOKEN'),
    defaultUserId: text('LOCAL_DASHBOARD_USER_ID', 'local-user'),
    maxBodyChars: boundedInteger('LOCAL_DASHBOARD_MAX_BODY_CHARS', 1000000, 1024, 10 * 1024 * 1024)
  })
});
