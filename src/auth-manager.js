class AuthManager {
  constructor(config = {}) {
	this.config = {
	  requireAllowlist: config.requireAllowlist ?? true,
	  allowPublicCommands: config.allowPublicCommands ?? true,
	  allowDirectMessages: config.allowDirectMessages ?? false,
	  allowedGuildIds: config.allowedGuildIds || [],
	  allowedChannelIds: config.allowedChannelIds || [],
	  allowedUserIds: config.allowedUserIds || [],
	  allowedRoleIds: config.allowedRoleIds || [],
	  adminUserIds: config.adminUserIds || [],
	  adminRoleIds: config.adminRoleIds || [],
	  ...config
	};
  }

  /**
   * Vérifie si un utilisateur est administrateur
   * @param {Object} user - Objet Discord User
   * @param {Object} member - Objet Discord GuildMember (optionnel)
   * @returns {boolean}
   */
  isAdmin(user, member = null) {
	// Vérifier si l'utilisateur est dans la liste admin
	if (this.config.adminUserIds.includes(user.id)) {
	  return true;
	}

	// Vérifier les rôles admin (si membre fourni)
	if (member && member.roles) {
	  if (this.config.adminRoleIds.some(roleId => member.roles.has(roleId))) {
		return true;
	  }
	}

	return false;
  }

  /**
   * Vérifie si un utilisateur est autorisé à utiliser une commande
   * @param {Object} user - Objet Discord User
   * @param {Object} member - Objet Discord GuildMember
   * @param {Object} channel - Objet Discord Channel
   * @param {Object} guild - Objet Discord Guild
   * @returns {Object} { allowed: boolean, reason: string }
   */
  checkUserPermission(user, member, channel, guild) {
	// Les admins ont toujours accès
	if (this.isAdmin(user, member)) {
	  return { allowed: true, reason: "admin_access" };
	}

	// Vérifier si c'est un DM
	if (!guild) {
	  if (!this.config.allowDirectMessages) {
		return { 
		  allowed: false, 
		  reason: "direct_messages_disabled"
		};
	  }

	  // Pour les DMs, vérifier si l'utilisateur est whitelisté
	  if (this.config.requireAllowlist) {
		if (!this.config.allowedUserIds.includes(user.id)) {
		  return { 
			allowed: false, 
			reason: "user_not_whitelisted"
		  };
		}
	  }

	  return { allowed: true, reason: "dm_allowed_for_user" };
	}

	// Vérifier le serveur
	if (this.config.allowedGuildIds.length > 0) {
	  if (!this.config.allowedGuildIds.includes(guild.id)) {
		return { 
		  allowed: false, 
		  reason: "guild_not_whitelisted"
		};
	  }
	}

	// Vérifier le canal
	if (this.config.allowedChannelIds.length > 0) {
	  if (!this.config.allowedChannelIds.includes(channel.id)) {
		return { 
		  allowed: false, 
		  reason: "channel_not_whitelisted"
		};
	  }
	}

	// Vérifier l'utilisateur
	if (this.config.allowedUserIds.includes(user.id)) {
	  return { allowed: true, reason: "user_whitelisted" };
	}

	// Vérifier les rôles
	if (member && member.roles) {
	  if (this.config.allowedRoleIds.some(roleId => member.roles.has(roleId))) {
		return { allowed: true, reason: "role_whitelisted" };
	  }
	}

	// Si requireAllowlist est activé et l'utilisateur n'est pas whitelisté
	if (this.config.requireAllowlist) {
	  return { 
		allowed: false, 
		reason: "allowlist_required"
	  };
	}

	// Sinon autoriser (si des règles publiques le permettent)
	if (this.config.allowPublicCommands) {
	  return { allowed: true, reason: "public_access" };
	}

	return { 
	  allowed: false, 
	  reason: "access_denied"
	};
  }

  /**
   * Vérifie si un utilisateur peut utiliser une commande spécifique
   * @param {Object} user 
   * @param {Object} member 
   * @param {Object} channel 
   * @param {Object} guild 
   * @param {string} commandName 
   * @param {Object} commandPerms - Permissions spécifiques de la commande
   * @returns {Object}
   */
  checkCommandPermission(user, member, channel, guild, commandName, commandPerms = {}) {
	// Vérifier les permissions générales
	const generalCheck = this.checkUserPermission(user, member, channel, guild);
	if (!generalCheck.allowed) {
	  return generalCheck;
	}

	// Vérifier les permissions spécifiques à la commande
	if (commandPerms.adminOnly && !this.isAdmin(user, member)) {
	  return { 
		allowed: false, 
		reason: "command_admin_only"
	  };
	}

	if (commandPerms.requiredRoles && member && member.roles) {
	  const hasRequiredRole = commandPerms.requiredRoles.some(
		roleId => member.roles.has(roleId)
	  );
	  if (!hasRequiredRole) {
		return { 
		  allowed: false, 
		  reason: "command_role_required"
		};
	  }
	}

	return { allowed: true, reason: "command_allowed" };
  }

  /**
   * Ajoute un utilisateur à la whitelist
   * @param {string} userId 
   */
  whitelistUser(userId) {
	if (!this.config.allowedUserIds.includes(userId)) {
	  this.config.allowedUserIds.push(userId);
	}
  }

  /**
   * Retire un utilisateur de la whitelist
   * @param {string} userId 
   */
  removeFromWhitelist(userId) {
	const index = this.config.allowedUserIds.indexOf(userId);
	if (index > -1) {
	  this.config.allowedUserIds.splice(index, 1);
	}
  }

  /**
   * Ajoute un administrateur
   * @param {string} userId 
   */
  addAdmin(userId) {
	if (!this.config.adminUserIds.includes(userId)) {
	  this.config.adminUserIds.push(userId);
	}
  }

  /**
   * Retire un administrateur
   * @param {string} userId 
   */
  removeAdmin(userId) {
	const index = this.config.adminUserIds.indexOf(userId);
	if (index > -1) {
	  this.config.adminUserIds.splice(index, 1);
	}
  }

  /**
   * Obtient un résumé de la configuration
   * @returns {Object}
   */
  getConfig() {
	return {
	  requireAllowlist: this.config.requireAllowlist,
	  allowPublicCommands: this.config.allowPublicCommands,
	  allowDirectMessages: this.config.allowDirectMessages,
	  allowedGuildCount: this.config.allowedGuildIds.length,
	  allowedChannelCount: this.config.allowedChannelIds.length,
	  allowedUserCount: this.config.allowedUserIds.length,
	  allowedRoleCount: this.config.allowedRoleIds.length,
	  adminUserCount: this.config.adminUserIds.length,
	  adminRoleCount: this.config.adminRoleIds.length
	};
  }
}

module.exports = AuthManager;
