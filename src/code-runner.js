const Docker = require('dockerode');
const { clipBytes, id, sleep } = require('./utils');

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

class CodeRunner {
  constructor(config, execution) {
    this.config = config;
    this.execution = execution;
    this.docker = new Docker({ socketPath: config.socketPath });
    this.containers = new Map();
    this.taskContainers = new Map();
    this.images = new Set();
  }

  async ensureImage(image) {
    if (this.images.has(image)) return;

    await this.docker.getImage(image).inspect().catch(async (error) => {
      if (!/no such image|not found/i.test(error.message) || !this.config.autoPullImages) throw error;
      await this.pullImage(image);
    });

    this.images.add(image);
  }

  async pullImage(image) {
    await new Promise((resolve, reject) => {
      this.docker.pull(image, (error, stream) => {
        if (error) return reject(error);
        return this.docker.modem.followProgress(stream, (progressError) =>
          progressError ? reject(progressError) : resolve()
        );
      });
    });
  }

  async run(input, context = {}) {
    const language = input.language === 'javascript' ? 'javascript' : 'python';
    const code = String(input.code || '');
    if (!code.trim()) throw new Error('Code payload is empty.');
    if (code.length > this.execution.codeMaxChars) {
      throw new Error(`Code payload is too long. Limit: ${this.execution.codeMaxChars} characters.`);
    }

    const image = language === 'javascript' ? this.config.nodeImage : this.config.pythonImage;
    const command = language === 'javascript' ? ['node', '-e', code] : ['python', '-c', code];
    const containerId = id();
    const taskId = context.taskId || containerId;
    let container = null;

    await this.ensureImage(image);

    try {
      container = await this.docker.createContainer({
        Image: image,
        Cmd: command,
        WorkingDir: '/tmp',
        User: this.config.runUser,
        Env: ['PYTHONDONTWRITEBYTECODE=1', 'NODE_OPTIONS=--no-deprecation'],
        OpenStdin: false,
        AttachStdout: true,
        AttachStderr: true,
        Labels: {
          app: 'longyan-tianji',
          task: containerId,
          ownerTask: taskId
        },
        HostConfig: {
          Memory: this.config.memoryMb * 1024 * 1024,
          MemorySwap: this.config.memoryMb * 1024 * 1024,
          CpuPeriod: 100000,
          CpuQuota: this.config.cpuQuota,
          NetworkMode: this.config.networkMode,
          PidsLimit: this.config.pidsLimit,
          ReadonlyRootfs: this.config.readOnlyRootFs,
          CapDrop: this.config.capDropAll ? ['ALL'] : undefined,
          SecurityOpt: this.config.noNewPrivileges ? ['no-new-privileges:true'] : undefined,
          Tmpfs: {
            '/tmp': `rw,noexec,nosuid,size=${this.config.tmpfsSizeMb}m`
          }
        }
      });

      this.containers.set(containerId, container);
      this.taskContainers.set(taskId, container);
      await container.start();

      const outcome = await Promise.race([
        container.wait(),
        sleep(this.execution.codeTimeoutMs).then(() => ({ StatusCode: 124, timedOut: true }))
      ]);

      if (outcome.timedOut) {
        await container.kill().catch(() => {});
      }

      const logs = await container.logs({ stdout: true, stderr: true });

      return {
        containerId,
        language,
        image,
        exitCode: outcome.StatusCode,
        timedOut: Boolean(outcome.timedOut),
        output: clipBytes(decodeDockerLog(logs).trim(), this.execution.codeMaxOutputChars)
      };
    } catch (error) {
      return {
        containerId,
        language,
        image,
        error: error.message
      };
    } finally {
      if (container) await container.remove({ force: true }).catch(() => {});
      this.containers.delete(containerId);
      this.taskContainers.delete(taskId);
    }
  }

  async health() {
    return await this.docker.ping().then(() => ({ docker: true })).catch((error) => ({
      docker: false,
      error: error.message
    }));
  }

  cleanup() {
    for (const container of this.containers.values()) {
      container.remove({ force: true }).catch(() => {});
    }
    this.containers.clear();
    this.taskContainers.clear();
  }

  async cancelTask(taskId) {
    const container = this.taskContainers.get(taskId);
    if (!container) return false;
    await container.kill().catch(() => {});
    await container.remove({ force: true }).catch(() => {});
    this.taskContainers.delete(taskId);
    return true;
  }
}

module.exports = CodeRunner;
