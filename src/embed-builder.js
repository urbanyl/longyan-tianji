const { EmbedBuilder: DiscordEmbedBuilder } = require("discord.js");

class EmbedBuilder {
  constructor() {
	this.colors = {
	  primary: 0x3498db,    // Bleu
	  success: 0x2ecc71,    // Vert
	  warning: 0xf39c12,    // Orange
	  error: 0xe74c3c,      // Rouge
	  info: 0x9b59b6,       // Violet
	  chat: 0x1abc9c        // Cyan
	};

	this.translations = {
	  en: {
		chat: "Chat",
		error: "Error",
		success: "Success",
		info: "Information",
		unauthorized: "Unauthorized",
		help: "Help",
		commands: "Commands",
		notAllowed: "This command is not available for you.",
		memoryStats: "Memory Statistics",
		typingMessage: "Typing..."
	  },
	  zh: {
		chat: "聊天",
		error: "错误",
		success: "成功",
		info: "信息",
		unauthorized: "未授权",
		help: "帮助",
		commands: "命令",
		notAllowed: "您没有使用此命令的权限。",
		memoryStats: "内存统计",
		typingMessage: "正在输入..."
	  }
	};
  }

  /**
   * Obtient la traduction d'une clé
   * @param {string} lang - "en" ou "zh"
   * @param {string} key - Clé de traduction
   * @returns {string} Texte traduit
   */
  t(lang = "en", key, defaultValue = key) {
	return this.translations[lang]?.[key] ?? this.translations.en[key] ?? defaultValue;
  }

  /**
   * Crée un embed de réponse chat
   * @param {string} message - Le message
   * @param {string} authorName - Nom de l'auteur
   * @param {string} lang - "en" ou "zh"
   * @returns {EmbedBuilder}
   */
  createChatEmbed(message, authorName = "AI Assistant", lang = "en") {
	return new DiscordEmbedBuilder()
	  .setColor(this.colors.chat)
	  .setAuthor({ name: authorName, iconURL: null })
	  .setDescription(message)
	  .setTimestamp()
	  .setFooter({ text: `${this.t(lang, "chat")} • ${lang.toUpperCase()}` });
  }

  /**
   * Crée un embed d'erreur
   * @param {string} errorMessage - Le message d'erreur
   * @param {string} lang - "en" ou "zh"
   * @returns {EmbedBuilder}
   */
  createErrorEmbed(errorMessage, lang = "en") {
	const title = this.t(lang, "error");
	return new DiscordEmbedBuilder()
	  .setColor(this.colors.error)
	  .setTitle(title)
	  .setDescription(errorMessage)
	  .setTimestamp()
	  .setFooter({ text: lang.toUpperCase() });
  }

  /**
   * Crée un embed de succès
   * @param {string} successMessage - Le message de succès
   * @param {string} title - Titre optionnel
   * @param {string} lang - "en" ou "zh"
   * @returns {EmbedBuilder}
   */
  createSuccessEmbed(successMessage, title = "", lang = "en") {
	const embed = new DiscordEmbedBuilder()
	  .setColor(this.colors.success)
	  .setDescription(successMessage)
	  .setTimestamp()
	  .setFooter({ text: lang.toUpperCase() });

	if (title) {
	  embed.setTitle(title);
	}

	return embed;
  }

  /**
   * Crée un embed d'information
   * @param {string} infoMessage - Le message
   * @param {string} title - Titre optionnel
   * @param {Object} fields - Champs supplémentaires { name, value, inline }
   * @param {string} lang - "en" ou "zh"
   * @returns {EmbedBuilder}
   */
  createInfoEmbed(infoMessage, title = "", fields = [], lang = "en") {
	const embed = new DiscordEmbedBuilder()
	  .setColor(this.colors.info)
	  .setDescription(infoMessage)
	  .setTimestamp()
	  .setFooter({ text: lang.toUpperCase() });

	if (title) {
	  embed.setTitle(title);
	}

	if (Array.isArray(fields) && fields.length > 0) {
	  fields.forEach(field => {
		embed.addFields(field);
	  });
	}

	return embed;
  }

  /**
   * Crée un embed non autorisé
   * EN: "You are not authorized to use this command."
   * ZH: "抱歉，您没有被政府授权使用此高级助手服务。"
   * @param {string} lang - "en" ou "zh"
   * @returns {EmbedBuilder}
   */
  createUnauthorizedEmbed(lang = "en") {
	const messages = {
	  en: {
		title: "Unauthorized",
		description: "You are not authorized to use this command."
	  },
	  zh: {
		title: "未授权",
		description: "抱歉，您没有被政府授权使用此高级助手服务。"
	  }
	};

	const msg = messages[lang] || messages.en;

	return new DiscordEmbedBuilder()
	  .setColor(this.colors.error)
	  .setTitle(msg.title)
	  .setDescription(msg.description)
	  .setTimestamp()
	  .setFooter({ text: lang.toUpperCase() });
  }

  /**
   * Crée un embed d'aide
   * @param {Array} commands - Array de { name, description, usage }
   * @param {string} lang - "en" ou "zh"
   * @returns {EmbedBuilder}
   */
  createHelpEmbed(commands, lang = "en") {
	const titles = {
	  en: "Available Commands",
	  zh: "可用命令"
	};

	const embed = new DiscordEmbedBuilder()
	  .setColor(this.colors.primary)
	  .setTitle(titles[lang] || "Available Commands")
	  .setTimestamp()
	  .setFooter({ text: lang.toUpperCase() });

	commands.forEach(cmd => {
	  embed.addFields({
		name: `\`${cmd.name}\``,
		value: `${cmd.description}\n*Usage: \`${cmd.usage}\`*`,
		inline: false
	  });
	});

	return embed;
  }

  /**
   * Crée un embed de statistiques mémoire
   * @param {Object} userMemory - Données de mémoire utilisateur
   * @param {string} lang - "en" ou "zh"
   * @returns {EmbedBuilder}
   */
  createMemoryStatsEmbed(userMemory, lang = "en") {
	const titles = {
	  en: "Your Memory Profile",
	  zh: "您的记忆档案"
	};

	const labels = {
	  en: {
		totalInteractions: "Total Interactions",
		totalMessages: "Total Messages",
		firstSeen: "First Seen",
		lastSeen: "Last Seen",
		language: "Language",
		talkingStyle: "Talking Style",
		interests: "Interests",
		conversationLength: "Conversation History"
	  },
	  zh: {
		totalInteractions: "总交互数",
		totalMessages: "总消息数",
		firstSeen: "首次见面",
		lastSeen: "最后交互",
		language: "语言",
		talkingStyle: "说话风格",
		interests: "兴趣",
		conversationLength: "对话历史"
	  }
	};

	const l = labels[lang] || labels.en;

	const embed = new DiscordEmbedBuilder()
	  .setColor(this.colors.chat)
	  .setTitle(titles[lang] || "Your Memory Profile")
	  .addFields(
		{
		  name: l.totalInteractions,
		  value: `${userMemory.interactions.totalInteractions}`,
		  inline: true
		},
		{
		  name: l.totalMessages,
		  value: `${userMemory.interactions.totalMessages}`,
		  inline: true
		},
		{
		  name: l.language,
		  value: userMemory.profile.language.toUpperCase(),
		  inline: true
		}
	  );

	if (userMemory.interactions.firstInteraction) {
	  embed.addFields({
		name: l.firstSeen,
		value: new Date(userMemory.interactions.firstInteraction).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US"),
		inline: true
	  });
	}

	if (userMemory.interactions.lastInteraction) {
	  embed.addFields({
		name: l.lastSeen,
		value: new Date(userMemory.interactions.lastInteraction).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US"),
		inline: true
	  });
	}

	if (userMemory.characteristics.talkingStyle) {
	  embed.addFields({
		name: l.talkingStyle,
		value: userMemory.characteristics.talkingStyle.substring(0, 100),
		inline: false
	  });
	}

	if (userMemory.characteristics.topics.length > 0) {
	  embed.addFields({
		name: l.interests,
		value: userMemory.characteristics.topics.slice(0, 5).join(", "),
		inline: false
	  });
	}

	if (userMemory.conversationHistory.length > 0) {
	  embed.addFields({
		name: l.conversationLength,
		value: `${userMemory.conversationHistory.length} messages`,
		inline: true
	  });
	}

	embed.setTimestamp();
	embed.setFooter({ text: lang.toUpperCase() });

	return embed;
  }

  /**
   * Crée un embed de commande slash
   * @param {string} commandName 
   * @param {string} commandDesc 
   * @param {Object} options - { fields: Array, lang: string }
   * @returns {EmbedBuilder}
   */
  createCommandEmbed(commandName, commandDesc, options = {}) {
	const lang = options.lang || "en";
	const embed = new DiscordEmbedBuilder()
	  .setColor(this.colors.primary)
	  .setTitle(`/${commandName}`)
	  .setDescription(commandDesc)
	  .setTimestamp()
	  .setFooter({ text: lang.toUpperCase() });

	if (options.fields) {
	  options.fields.forEach(field => {
		embed.addFields(field);
	  });
	}

	return embed;
  }

  /**
   * Crée un embed de réponse simple
   * @param {string} title 
   * @param {string} description 
   * @param {string} lang 
   * @returns {EmbedBuilder}
   */
  createSimpleEmbed(title = "", description = "", lang = "en") {
	return new DiscordEmbedBuilder()
	  .setColor(this.colors.primary)
	  .setTitle(title)
	  .setDescription(description)
	  .setTimestamp()
	  .setFooter({ text: lang.toUpperCase() });
  }
}

module.exports = EmbedBuilder;
