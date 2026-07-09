const { createReadStream, promises: fsPromises } = require('fs');
const { createServer } = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { redactSecrets } = require('./utils');
const OpenRouterHandler = require('./openrouter-handler');

class LocalDashboard {
  constructor({ config, orchestrator }) {
    this.rootConfig = config;
    this.config = config.localDashboard;
    this.orchestrator = orchestrator;
    this.server = createServer((req, res) => this.route(req, res));
    this.sealPath = path.join(config.rootDir, 'assets', 'longyan-tianji-seal.png');
  }

  async start() {
    // Try to bind to configured port. If port is in use, try next ports up to a limit.
    const maxAttempts = 10;
    let attempt = 0;
    let bound = false;
    let port = Number(this.config.port) || 3010;

    while (!bound && attempt < maxAttempts) {
      try {
        await new Promise((resolve, reject) => {
          const onError = (err) => reject(err);
          this.server.once('error', onError);
          this.server.listen(port, this.config.host, () => {
            this.server.off('error', onError);
            resolve();
          });
        });
        bound = true;
      } catch (err) {
        if (err && err.code === 'EADDRINUSE') {
          console.warn(`Port ${port} is in use, trying ${port + 1}...`);
          port += 1;
          attempt += 1;
        } else {
          throw err;
        }
      }
    }

    if (!bound) throw new Error(`Unable to bind local dashboard after ${maxAttempts} attempts starting at port ${this.config.port}`);

    const url = `http://${this.config.host}:${port}/`;
    console.log(`${this.rootConfig.brand.bot} local dashboard is available at ${url}`);
    if (this.config.open) this.openBrowser(url);
    return url;
  }

  async close() {
    if (!this.server.listening) return;
    await new Promise((resolve) => this.server.close(resolve));
  }

  async route(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    try {
      if (url.pathname === '/') return this.html(res);
      if (url.pathname === '/seal.png') return this.seal(res);

      if (url.pathname.startsWith('/api/') && !this.authorized(req, url)) {
        return this.json(res, 401, { error: 'Dashboard token is required.' });
      }

      if (req.method === 'GET' && url.pathname === '/api/health') return await this.health(res);
      if (req.method === 'GET' && url.pathname === '/api/config') return this.configJson(res);
      if (req.method === 'GET' && url.pathname === '/api/env') return await this.env(res);
      if (req.method === 'POST' && url.pathname === '/api/env') return await this.setEnv(req, res);
      if (req.method === 'POST' && url.pathname === '/api/restart') return await this.restart(req, res);
      if (req.method === 'POST' && url.pathname === '/api/openrouter/test') return await this.testOpenRouter(req, res);
      if (req.method === 'GET' && url.pathname === '/api/audit') return await this.auditList(res);
      if (req.method === 'GET' && url.pathname === '/api/profile') return await this.profile(res, url);
      if (req.method === 'POST' && url.pathname === '/api/profile') return await this.updateProfile(req, res);
      if (req.method === 'POST' && url.pathname === '/api/preference') return await this.preference(req, res);
      if (req.method === 'POST' && url.pathname === '/api/forget') return await this.forgetPreference(req, res);
      if (req.method === 'GET' && url.pathname === '/api/memory') return await this.memory(res, url);
      if (req.method === 'POST' && url.pathname === '/api/memory') return await this.setMemory(req, res);
      if (req.method === 'POST' && url.pathname === '/api/execute') return await this.execute(req, res);
      if (req.method === 'GET' && url.pathname === '/api/session') return await this.session(res, url);
      if (req.method === 'GET' && url.pathname === '/api/task') return await this.task(res, url);
      if (req.method === 'POST' && url.pathname === '/api/cancel') return await this.cancel(req, res);
      if (req.method === 'GET' && url.pathname === '/api/research') return await this.research(res, url);

      return this.json(res, 404, { error: 'Not found.' });
    } catch (error) {
      return this.json(res, 500, { error: redactSecrets(error.message) });
    }
  }

  auditAppend(entry) {
    try {
      const logPath = path.join(this.rootConfig.rootDir, 'local-dashboard-audit.log');
      const line = `${new Date().toISOString()} ${entry}\n`;
      fsPromises.appendFile(logPath, line).catch(() => {});
    } catch (err) {}
  }

  async auditList(res) {
    try {
      const logPath = path.join(this.rootConfig.rootDir, 'local-dashboard-audit.log');
      const raw = await fsPromises.readFile(logPath, 'utf8').catch(() => '');
      return this.json(res, 200, { log: raw.split('\n').filter(Boolean).slice(-200) });
    } catch (error) {
      return this.json(res, 500, { error: 'Unable to read audit log.' });
    }
  }

  async env(res) {
    try {
      const envPath = path.resolve(this.rootConfig.rootDir, '.env');
      const raw = await fsPromises.readFile(envPath, 'utf8').catch(() => '');
      // Redact secrets before returning
      const redacted = raw
        .replace(/(DISCORD_TOKEN)=.*/g, '$1=[redacted]')
        .replace(/(DISCORD_USER_TOKEN)=.*/g, '$1=[redacted]')
        .replace(/(OPENROUTER_API_KEY)=.*/g, '$1=[redacted]')
        .replace(/(LOCAL_DASHBOARD_TOKEN)=.*/g, '$1=[redacted]');
      return this.json(res, 200, { env: redacted });
    } catch (error) {
      return this.json(res, 500, { error: 'Unable to read .env' });
    }
  }

  async setEnv(req, res) {
    try {
      const body = await this.body(req);
      const envText = body.env || '';
      const envPath = path.resolve(this.rootConfig.rootDir, '.env');
      await fsPromises.writeFile(envPath, envText, 'utf8');
      // Update process.env for immediate use (best-effort)
      envText.split(/\r?\n/).forEach((line) => {
        const m = line.match(/^([^=#]+)=(.*)$/);
        if (m) {
          const k = m[1].trim();
          let v = m[2] || '';
          // remove surrounding quotes
          if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
          }
          process.env[k] = v;
        }
      });
      this.auditAppend(`env updated via dashboard`);
      return this.json(res, 200, { ok: true });
    } catch (error) {
      return this.json(res, 500, { error: 'Unable to write .env' });
    }
  }

  async restart(req, res) {
    // append audit then respond and exit
    this.auditAppend('restart requested via dashboard');
    this.json(res, 200, { ok: true });
    // slight delay to let response flush
    setTimeout(() => process.exit(0), 250);
  }

  async testOpenRouter(req, res) {
    try {
      const body = await this.body(req);
      const apiKey = (body && body.apiKey) || process.env.OPENROUTER_API_KEY || '';
      if (!apiKey) return this.json(res, 400, { error: 'apiKey is required' });
      try {
        const handler = new OpenRouterHandler(apiKey);
        const ok = await handler.testConnection();
        this.auditAppend(`openrouter test: ${ok}`);
        return this.json(res, 200, { ok });
      } catch (err) {
        this.auditAppend(`openrouter test failed: ${String(err.message)}`);
        return this.json(res, 500, { error: err.message });
      }
    } catch (error) {
      return this.json(res, 500, { error: 'Test failed' });
    }
  }

  authorized(req, url) {
    if (!this.config.token) return true;
    const header = req.headers['x-dashboard-token'] || '';
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const query = url.searchParams.get('token') || '';
    return [header, bearer, query].includes(this.config.token);
  }

  userId(url, body = {}) {
    return body.userId || url.searchParams.get('userId') || this.config.defaultUserId;
  }

  localMemoryPrefix(userId) {
    return `local:${userId}:`;
  }

  async health(res) {
    const runtime = process.memoryUsage();
    const health = await this.orchestrator.health();
    return this.json(res, 200, {
      uptimeSeconds: Math.round(process.uptime()),
      pid: process.pid,
      memory: {
        rss: runtime.rss,
        heapUsed: runtime.heapUsed,
        heapTotal: runtime.heapTotal,
        external: runtime.external
      },
      health
    });
  }

  configJson(res) {
    const safe = {
      brand: this.rootConfig.brand,
      execution: this.rootConfig.execution,
      docker: this.rootConfig.docker,
      browser: this.rootConfig.browser,
      output: this.rootConfig.output,
      security: this.rootConfig.security,
      memory: this.rootConfig.memory,
      assistant: this.rootConfig.assistant,
      research: {
        ...this.rootConfig.research,
        serpApiKey: this.rootConfig.research.serpApiKey ? '[configured]' : ''
      },
      localDashboard: {
        ...this.rootConfig.localDashboard,
        token: this.rootConfig.localDashboard.token ? '[configured]' : ''
      }
    };
    return this.json(res, 200, safe);
  }

  async profile(res, url) {
    return this.json(res, 200, await this.orchestrator.getProfile(this.userId(url)));
  }

  async updateProfile(req, res) {
    const body = await this.body(req);
    const userId = this.userId(new URL(req.url, 'http://localhost'), body);
    const profile = await this.orchestrator.updateProfile(userId, {
      botName: body.botName,
      userName: body.userName,
      speakingStyle: body.speakingStyle,
      personality: body.personality,
      notes: body.notes
    });
    return this.json(res, 200, await this.orchestrator.getProfile(profile.userId));
  }

  async preference(req, res) {
    const body = await this.body(req);
    const userId = body.userId || this.config.defaultUserId;
    const profile = await this.orchestrator.rememberPreference(userId, body.key, body.value);
    return this.json(res, 200, profile);
  }

  async forgetPreference(req, res) {
    const body = await this.body(req);
    const userId = body.userId || this.config.defaultUserId;
    const profile = await this.orchestrator.forgetPreference(userId, body.key);
    return this.json(res, 200, profile);
  }

  async memory(res, url) {
    const userId = this.userId(url);
    const items = await this.orchestrator.memory.listMemory(this.rootConfig.memory.listLimit, this.localMemoryPrefix(userId));
    return this.json(res, 200, {
      userId,
      items: items.map((item) => ({
        ...item,
        key: item.key.slice(this.localMemoryPrefix(userId).length)
      }))
    });
  }

  async setMemory(req, res) {
    const body = await this.body(req);
    const userId = body.userId || this.config.defaultUserId;
    const key = String(body.key || '').trim();
    if (!key || key.includes(':')) return this.json(res, 400, { error: 'A memory key without colon is required.' });
    await this.orchestrator.memory.setMemory(`${this.localMemoryPrefix(userId)}${key}`, body.value || '');
    return this.json(res, 200, { ok: true });
  }

  async execute(req, res) {
    const body = await this.body(req);
    const userId = body.userId || this.config.defaultUserId;
    const task = await this.orchestrator.execute(body.command, {
      sessionId: `local:${userId}`,
      userId: `local:${userId}`,
      channelId: 'local-dashboard',
      guildId: 'local-dashboard'
    });
    const waitMs = Math.min(Number(body.waitMs) || this.rootConfig.execution.replyWaitMs, this.rootConfig.execution.replyWaitMs);
    const done = await this.orchestrator.waitForTask(task.id, waitMs);
    return this.json(res, 200, done || task);
  }

  async session(res, url) {
    const userId = this.userId(url);
    return this.json(res, 200, await this.orchestrator.getSession(`local:${userId}`));
  }

  async task(res, url) {
    const id = url.searchParams.get('id');
    if (!id) return this.json(res, 400, { error: 'Task id is required.' });
    return this.json(res, 200, await this.orchestrator.getStatus(id));
  }

  async cancel(req, res) {
    const body = await this.body(req);
    if (!body.id) return this.json(res, 400, { error: 'Task id is required.' });
    return this.json(res, 200, await this.orchestrator.cancelTask(body.id));
  }

  async research(res, url) {
    const query = url.searchParams.get('query') || '';
    return this.json(res, 200, await this.orchestrator.research.search(query));
  }

  async body(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > this.config.maxBodyChars) throw new Error('Request body is too large.');
      chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    return text ? JSON.parse(text) : {};
  }

  json(res, status, payload) {
    const body = JSON.stringify(payload, null, 2);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(body);
  }

  seal(res) {
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600'
    });
    createReadStream(this.sealPath).on('error', () => res.end()).pipe(res);
  }

  html(res) {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(this.page());
  }

  page() {
    const token = JSON.stringify(this.config.token || '');
    const defaultUserId = JSON.stringify(this.config.defaultUserId);
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Longyan Tianji Dashboard</title>
  <style>
    :root { color-scheme: light; --red:#a40011; --ink:#1f2937; --muted:#667085; --line:#d8dde6; --paper:#f3f5f7; --panel:#ffffff; --nav:#111827; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Inter, "Segoe UI", Arial, sans-serif; color:var(--ink); background:var(--paper); }
    header { display:flex; align-items:center; gap:18px; padding:18px 28px; background:var(--panel); border-top:4px solid var(--red); border-bottom:1px solid var(--line); position:sticky; top:0; z-index:1; }
    header img { width:72px; height:72px; object-fit:contain; border-radius:3px; }
    h1 { margin:0; font-size:24px; letter-spacing:0; }
    header p { margin:6px 0 0; color:var(--muted); }
    main { padding:24px; display:grid; grid-template-columns: minmax(320px, 420px) 1fr; gap:18px; }
    section { background:var(--panel); border:1px solid var(--line); border-radius:3px; padding:16px; box-shadow:0 1px 2px rgba(16,24,40,.04); }
    h2 { margin:0 0 12px; font-size:16px; border-left:3px solid var(--red); padding-left:8px; }
    label { display:block; margin:10px 0 6px; font-size:12px; font-weight:700; color:#344054; text-transform:uppercase; }
    input, select, textarea { width:100%; border:1px solid #c9ced8; border-radius:2px; padding:10px; font:inherit; background:#fff; }
    input:focus, select:focus, textarea:focus { outline:2px solid rgba(164,0,17,.14); border-color:var(--red); }
    textarea { min-height:84px; resize:vertical; }
    button { border:1px solid var(--nav); border-radius:2px; padding:10px 13px; font-weight:700; background:var(--nav); color:#fff; cursor:pointer; }
    button.secondary { background:#fff; color:var(--nav); border-color:#98a2b3; }
    button:hover { filter:brightness(.96); }
    .row { display:flex; gap:8px; align-items:center; }
    .row > * { flex:1; }
    .grid { display:grid; grid-template-columns: repeat(4, minmax(120px,1fr)); gap:10px; margin-bottom:18px; }
    .metric { background:var(--panel); border:1px solid var(--line); border-radius:3px; padding:12px; border-top:3px solid #273142; }
    .metric b { display:block; font-size:22px; margin-top:4px; }
    pre { white-space:pre-wrap; word-break:break-word; background:#111827; color:#e5e7eb; padding:12px; border-radius:2px; min-height:120px; max-height:420px; overflow:auto; }
    .muted { color:var(--muted); font-size:13px; }
    @media (max-width: 980px) { main { grid-template-columns:1fr; } .grid { grid-template-columns: repeat(2, 1fr); } }
  </style>
</head>
<body>
  <header>
    <img src="/seal.png" alt="Longyan Tianji seal">
    <div>
      <h1>Longyan / Tianji Local Assistant</h1>
      <p>Personal profile, memory, command execution, research, and runtime monitoring.</p>
    </div>
  </header>
  <main>
    <div>
      <section>
        <h2>Personal Profile</h2>
        <label>User ID</label><input id="userId">
        <label>Assistant name</label><input id="botName">
        <label>Call me</label><input id="userName">
        <label>Speaking style</label><input id="speakingStyle">
        <label>Discord reply mode</label>
        <select id="replyMode">
          <option value="summary">summary - short readable result</option>
          <option value="files">files - attachments first, no JSON block</option>
          <option value="json">json - full debug payload</option>
          <option value="silent">silent - status only</option>
        </select>
        <label>Personality</label><textarea id="personality"></textarea>
        <label>Long-term notes</label><textarea id="notes"></textarea>
        <p><button onclick="saveProfile()">Save profile</button> <button class="secondary" onclick="loadProfile()">Reload</button></p>
      </section>
      <section style="margin-top:18px">
        <h2>Memory</h2>
        <div class="row"><input id="memoryKey" placeholder="preference key"><input id="memoryValue" placeholder="value"></div>
        <p><button onclick="saveMemory()">Store memory</button> <button class="secondary" onclick="loadMemory()">List memory</button></p>
        <pre id="memoryOut"></pre>
      </section>
    </div>
    <div>
      <div class="grid">
        <div class="metric">Uptime<b id="uptime">-</b></div>
        <div class="metric">RSS<b id="rss">-</b></div>
        <div class="metric">Tasks<b id="tasks">-</b></div>
        <div class="metric">Queue<b id="queue">-</b></div>
      </div>
      <section>
        <h2>Interact</h2>
        <textarea id="command" placeholder="open https://example.com screenshot"></textarea>
        <p><button onclick="executeCommand()">Run command</button> <button class="secondary" onclick="loadSession()">Load session</button></p>
        <pre id="output"></pre>
      </section>
      <section style="margin-top:18px">
        <h2>Free Research</h2>
        <div class="row"><input id="researchQuery" placeholder="search query"><button onclick="research()">Search</button></div>
        <pre id="researchOut"></pre>
      </section>
      <section style="margin-top:18px">
        <h2>Configuration</h2>
        <p class="muted">Secrets are redacted by the local API.</p>
        <p><button class="secondary" onclick="loadConfig()">Show config</button> <button class="secondary" onclick="loadHealth()">Refresh health</button></p>
        <pre id="configOut"></pre>
        <p style="margin-top:12px"><button onclick="loadEnv()">Edit .env</button> <button class="secondary" onclick="testOpenRouter()">Test OpenRouter</button> <button class="secondary" onclick="restartServer()">Restart Server</button></p>
        <textarea id="envArea" style="min-height:120px;display:none;margin-top:8px"></textarea>
        <p id="envActions" style="display:none"><button onclick="saveEnv()">Save .env</button> <button class="secondary" onclick="cancelEnv()">Cancel</button></p>
      </section>
    </div>
  </main>
<script>
const DASHBOARD_TOKEN = ${token};
const DEFAULT_USER_ID = ${defaultUserId};
document.getElementById('userId').value = DEFAULT_USER_ID;

async function api(path, options) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options && options.headers ? options.headers : {});
  if (DASHBOARD_TOKEN) headers['X-Dashboard-Token'] = DASHBOARD_TOKEN;
  const response = await fetch(path, Object.assign({}, options || {}, { headers }));
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function userId() { return document.getElementById('userId').value || DEFAULT_USER_ID; }
function show(id, value) { document.getElementById(id).textContent = JSON.stringify(value, null, 2); }
function mb(value) { return Math.round(value / 1024 / 1024) + ' MB'; }

async function loadProfile() {
  const profile = await api('/api/profile?userId=' + encodeURIComponent(userId()));
  for (const key of ['botName','userName','speakingStyle','personality','notes']) document.getElementById(key).value = profile[key] || '';
  document.getElementById('replyMode').value = profile.preferences && profile.preferences.reply_mode ? profile.preferences.reply_mode : 'summary';
}
async function saveProfile() {
  const body = { userId: userId() };
  for (const key of ['botName','userName','speakingStyle','personality','notes']) body[key] = document.getElementById(key).value;
  await api('/api/profile', { method:'POST', body: JSON.stringify(body) });
  await api('/api/preference', { method:'POST', body: JSON.stringify({ userId:userId(), key:'reply_mode', value:document.getElementById('replyMode').value }) });
  show('output', await api('/api/profile?userId=' + encodeURIComponent(userId())));
}
async function saveMemory() {
  await api('/api/memory', { method:'POST', body: JSON.stringify({ userId:userId(), key:document.getElementById('memoryKey').value, value:document.getElementById('memoryValue').value }) });
  await loadMemory();
}
async function loadMemory() { show('memoryOut', await api('/api/memory?userId=' + encodeURIComponent(userId()))); }
async function executeCommand() {
  show('output', await api('/api/execute', { method:'POST', body: JSON.stringify({ userId:userId(), command:document.getElementById('command').value, waitMs:60000 }) }));
  await loadHealth();
}
async function loadSession() { show('output', await api('/api/session?userId=' + encodeURIComponent(userId()))); }
async function research() { show('researchOut', await api('/api/research?query=' + encodeURIComponent(document.getElementById('researchQuery').value))); }
async function loadConfig() { show('configOut', await api('/api/config')); }
async function loadHealth() {
  const data = await api('/api/health');
  document.getElementById('uptime').textContent = data.uptimeSeconds + 's';
  document.getElementById('rss').textContent = mb(data.memory.rss);
  document.getElementById('tasks').textContent = data.health.memory.tasks;
  document.getElementById('queue').textContent = data.health.queue.active.length + '/' + data.health.queue.queued.length;
  show('configOut', data);
}
loadProfile().catch(console.error);
loadMemory().catch(console.error);
loadHealth().catch(console.error);
async function loadEnv() {
  try {
    const res = await api('/api/env');
    const area = document.getElementById('envArea');
    area.value = res.env || '';
    area.style.display = 'block';
    document.getElementById('envActions').style.display = 'block';
  } catch (err) { console.error(err); alert(err.message); }
}
function cancelEnv() { document.getElementById('envArea').style.display='none'; document.getElementById('envActions').style.display='none'; }
async function saveEnv() {
  try {
    const text = document.getElementById('envArea').value;
    await api('/api/env', { method:'POST', body: JSON.stringify({ env: text }) });
    alert('Saved. If you changed tokens, click Restart Server to apply.');
  } catch (err) { console.error(err); alert(err.message); }
}
async function testOpenRouter() {
  try {
    const apiKey = prompt('Paste OpenRouter API key to test (leave empty to use current .env):');
    const body = apiKey ? { apiKey } : {};
    const res = await api('/api/openrouter/test', { method:'POST', body: JSON.stringify(body) });
    alert('OpenRouter test: ' + (res.ok ? 'OK' : 'Failed'));
  } catch (err) { console.error(err); alert('Test failed: ' + (err.message || err)); }
}
async function restartServer() {
  if (!confirm('Restart server now? This will stop the process and should be restarted by your process manager.')) return;
  try { await api('/api/restart', { method:'POST', body: JSON.stringify({}) }); } catch (err) { console.error(err); alert('Restart request failed'); }
}
</script>
</body>
</html>`;
  }

  openBrowser(url) {
    const platform = process.platform;
    const command = platform === 'win32' ? 'cmd' : platform === 'darwin' ? 'open' : 'xdg-open';
    const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.unref();
  }
}

module.exports = LocalDashboard;
