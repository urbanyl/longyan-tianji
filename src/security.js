function hasAny(set, values) {
  return values.some((value) => set.has(value));
}

function rolesFrom(message) {
  const cache = message.member?.roles?.cache;
  if (!cache) return [];
  return [...cache.keys()];
}

class AccessController {
  constructor(config) {
    this.config = config;
    this.publicCommands = new Set(['help', 'ping', 'name']);
    this.adminCommands = new Set(['health', 'queue']);
    this.allowedGuildIds = new Set(config.allowedGuildIds);
    this.allowedChannelIds = new Set(config.allowedChannelIds);
    this.allowedUserIds = new Set(config.allowedUserIds);
    this.allowedRoleIds = new Set(config.allowedRoleIds);
    this.adminUserIds = new Set(config.adminUserIds);
    this.adminRoleIds = new Set(config.adminRoleIds);
  }

  isAdmin(message) {
    if (this.adminUserIds.has(message.author.id)) return true;
    return hasAny(this.adminRoleIds, rolesFrom(message));
  }

  isAllowedPrincipal(message) {
    if (this.allowedUserIds.has(message.author.id)) return true;
    return hasAny(this.allowedRoleIds, rolesFrom(message));
  }

  canRun(message, commandName) {
    const command = String(commandName || '').toLowerCase();
    const admin = this.isAdmin(message);

    if (this.publicCommands.has(command) && this.config.allowPublicCommands) {
      return { ok: true, admin };
    }

    if (!message.guildId && !this.config.allowDirectMessages) {
      return { ok: false, admin, reason: 'Direct messages are disabled for operational commands.' };
    }

    if (this.allowedGuildIds.size && !this.allowedGuildIds.has(message.guildId)) {
      return { ok: false, admin, reason: 'This Discord server is not allowed.' };
    }

    if (this.allowedChannelIds.size && !this.allowedChannelIds.has(message.channel.id)) {
      return { ok: false, admin, reason: 'This channel is not allowed for commands.' };
    }

    if (this.adminCommands.has(command) && !admin) {
      return { ok: false, admin, reason: 'This command requires an administrator allowlist entry.' };
    }

    if (admin) return { ok: true, admin };
    if (!this.config.requireAllowlist) return { ok: true, admin };
    if (this.isAllowedPrincipal(message)) return { ok: true, admin };

    return {
      ok: false,
      admin,
      reason: 'You are not in the bot allowlist. Set ALLOWED_USER_IDS, ALLOWED_ROLE_IDS, ADMIN_USER_IDS, or ADMIN_ROLE_IDS.'
    };
  }

  canReadTask(message, task) {
    if (!task) return false;
    return this.isAdmin(message) || task.userId === message.author.id;
  }

  canUseSession(message, sessionId) {
    return this.isAdmin(message) || sessionId === message.author.id;
  }

  memoryPrefix(message) {
    const guildId = message.guildId || 'dm';
    const channelId = message.channel?.id || 'unknown';
    const userId = message.author.id;

    if (this.config.memoryScope === 'global') return 'global:';
    if (this.config.memoryScope === 'guild') return `guild:${guildId}:`;
    if (this.config.memoryScope === 'channel') return `channel:${guildId}:${channelId}:`;
    return `user:${guildId}:${userId}:`;
  }
}

class RateLimiter {
  constructor(config) {
    this.config = config;
    this.buckets = new Map();
  }

  check(message, admin = false) {
    if (admin && this.config.bypassRateLimitForAdmins) return { ok: true };

    const key = message.author.id;
    const now = Date.now();
    const current = this.buckets.get(key);

    if (!current || now - current.startedAt >= this.config.rateLimitWindowMs) {
      this.buckets.set(key, { startedAt: now, count: 1 });
      return { ok: true };
    }

    current.count += 1;
    if (current.count <= this.config.rateLimitMaxCommands) return { ok: true };

    const retryAfterMs = this.config.rateLimitWindowMs - (now - current.startedAt);
    return { ok: false, retryAfterMs };
  }
}

module.exports = {
  AccessController,
  RateLimiter
};
