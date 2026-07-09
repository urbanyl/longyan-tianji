const { EmbedBuilder } = require("discord.js");

class InteractionHandler {
  constructor(client, orchestrator, config, additionalModules = {}) {
	this.client = client;
	this.orchestrator = orchestrator;
	this.config = config;
	this.brand = config.brand;

	// Modules additionnels
	this.userMemory = additionalModules.userMemory;
	this.embedBuilder = additionalModules.embedBuilder;
	this.authManager = additionalModules.authManager;
	this.openrouter = additionalModules.openrouter;
  }

  /**
   * Traite une interaction Discord (slash command)
   * @param {Interaction} interaction 
   */
  async handle(interaction) {
	if (!interaction.isChatInputCommand()) return;

	const { commandName, member, user, guild, channel } = interaction;

	// Vérifier les permissions
	if (this.authManager) {
	  const permCheck = this.authManager.checkUserPermission(user, member, channel, guild);
	  if (!permCheck.allowed) {
		const lang = this.userMemory?.load(user.id)?.profile?.language || "en";
		const embed = this.embedBuilder.createUnauthorizedEmbed(lang);
		return await interaction.reply({ embeds: [embed], ephemeral: true });
	  }
	}

	// Routage par commande
	try {
	  switch (commandName) {
		case "chat":
		  return await this.handleChat(interaction);
		case "ping":
		  return await this.handlePing(interaction);
		case "help":
		  return await this.handleHelp(interaction);
		case "memory":
		  return await this.handleMemory(interaction);
		case "profile":
		  return await this.handleProfile(interaction);
		case "stats":
		  return await this.handleStats(interaction);
		case "info":
		  return await this.handleInfo(interaction);
		case "clear-memory":
		  return await this.handleClearMemory(interaction);
		case "lang":
		  return await this.handleSetLanguage(interaction);
		case "feedback":
		  return await this.handleFeedback(interaction);
		default:
		  return await interaction.reply({
			content: `Commande inconnue: ${commandName}`,
			ephemeral: true
		  });
	  }
	} catch (error) {
	  console.error(`Error handling interaction ${commandName}:`, error);
	  const lang = this.userMemory?.load(user.id)?.profile?.language || "en";
	  const embed = this.embedBuilder.createErrorEmbed(error.message, lang);
	  return await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
	}
  }

  /**
   * Traite la commande /chat
   * @param {Interaction} interaction 
   */
  async handleChat(interaction) {
	const message = interaction.options.getString("message");
	const lang = this.userMemory?.load(interaction.user.id)?.profile?.language || "en";

	if (!this.openrouter) {
	  const embed = this.embedBuilder.createErrorEmbed(
		"OpenRouter n'est pas configuré. Définiez OPENROUTER_API_KEY.",
		lang
	  );
	  return await interaction.reply({ embeds: [embed], ephemeral: true });
	}

	// Charger la mémoire utilisateur
	const userMem = this.userMemory?.load(interaction.user.id);

	// Enregistrer l'interaction
	this.userMemory?.recordInteraction(interaction.user.id, {
	  type: "chat_command",
	  content: message
	});

	// Notifier que c'est typé
	await interaction.deferReply();

	try {
	  // Obtenir l'historique de conversation
	  const conversationHistory = userMem.conversationHistory.map(msg => ({
		role: msg.role,
		content: msg.content
	  })) || [];

	  // Construire le prompt système avec contexte utilisateur
	  let systemPrompt = "You are a helpful Discord assistant.";
	  if (userMem.characteristics.talkingStyle) {
		systemPrompt += ` The user speaks like this: ${userMem.characteristics.talkingStyle}`;
	  }
	  if (userMem.characteristics.personality) {
		systemPrompt += ` User personality: ${userMem.characteristics.personality}`;
	  }

	  const messages = [
		{ role: "system", content: systemPrompt },
		...conversationHistory,
		{ role: "user", content: message }
	  ];

		// Appeler OpenRouter
	  const response = await this.openrouter.chatWithStreaming(message, conversationHistory);

	  // Sauvegarder l'échange
	  this.userMemory?.addMessage(interaction.user.id, "user", message);
	  this.userMemory?.addMessage(interaction.user.id, "assistant", response.content);

	  // Analyser et mettre à jour les caractéristiques (simple heuristique)
	  this._updateCharacteristicsFromMessage(interaction.user.id, message);

	  // Répondre en texte simple (pas d'embed)
	  return await interaction.editReply({ content: response.content });
	} catch (error) {
	  console.error("Chat error:", error);
		return await interaction.editReply({ content: `Error: ${error.message}` });
	}
  }

  /**
   * Traite la commande /ping
   * @param {Interaction} interaction 
   */
  async handlePing(interaction) {
	const ping = this.client.ws.ping;
	const latency = interaction.createdTimestamp - interaction.createdTimestamp;

	const lang = this.userMemory?.load(interaction.user.id)?.profile?.language || "en";
	const titles = { en: "Pong! 🏓", zh: "乒乓! 🏓" };
	const labels = { en: "API Latency", zh: "API 延迟" };

	const embed = this.embedBuilder.createSimpleEmbed(
	  titles[lang] || "Pong! 🏓",
	  `${labels[lang]}: ${ping}ms`,
	  lang
	);

	return await interaction.reply({ embeds: [embed] });
  }

  /**
   * Traite la commande /help
   * @param {Interaction} interaction 
   */
  async handleHelp(interaction) {
	const lang = this.userMemory?.load(interaction.user.id)?.profile?.language || "en";

	const commands = [
	  {
		name: "chat",
		description: lang === "zh" ? "与 AI 聊天" : "Chat with the AI",
		usage: "/chat message: Hello"
	  },
	  {
		name: "ping",
		description: lang === "zh" ? "检查机器人延迟" : "Check bot latency",
		usage: "/ping"
	  },
	  {
		name: "help",
		description: lang === "zh" ? "显示帮助信息" : "Show help message",
		usage: "/help"
	  },
	  {
		name: "memory",
		description: lang === "zh" ? "查看您的记忆统计" : "View your memory stats",
		usage: "/memory"
	  },
	  {
		name: "profile",
		description: lang === "zh" ? "查看您的档案" : "View your profile",
		usage: "/profile"
	  }
	];

	const embed = this.embedBuilder.createHelpEmbed(commands, lang);
	return await interaction.reply({ embeds: [embed] });
  }

  /**
   * Traite la commande /memory
   * @param {Interaction} interaction 
   */
  async handleMemory(interaction) {
	const userMem = this.userMemory?.load(interaction.user.id);
	const lang = userMem?.profile?.language || "en";

	const titles = {
	  en: "Your Memory Statistics",
	  zh: "您的记忆统计"
	};

	const embed = this.embedBuilder.createMemoryStatsEmbed(userMem, lang);
	return await interaction.reply({ embeds: [embed] });
  }

  /**
   * Traite la commande /profile
   * @param {Interaction} interaction 
   */
  async handleProfile(interaction) {
	const userMem = this.userMemory?.load(interaction.user.id);
	const lang = userMem?.profile?.language || "en";

	const labels = {
	  en: {
		title: "Your Profile",
		language: "Language",
		talkingStyle: "Talking Style",
		personality: "Personality",
		interests: "Interests"
	  },
	  zh: {
		title: "您的档案",
		language: "语言",
		talkingStyle: "说话风格",
		personality: "性格",
		interests: "兴趣"
	  }
	};

	const l = labels[lang] || labels.en;

	const fields = [];

	fields.push({
	  name: l.language,
	  value: userMem.profile.language.toUpperCase(),
	  inline: true
	});

	if (userMem.characteristics.talkingStyle) {
	  fields.push({
		name: l.talkingStyle,
		value: userMem.characteristics.talkingStyle.substring(0, 100),
		inline: false
	  });
	}

	if (userMem.characteristics.personality) {
	  fields.push({
		name: l.personality,
		value: userMem.characteristics.personality,
		inline: false
	  });
	}

	if (userMem.characteristics.topics.length > 0) {
	  fields.push({
		name: l.interests,
		value: userMem.characteristics.topics.slice(0, 5).join(", "),
		inline: false
	  });
	}

	const embed = this.embedBuilder.createCommandEmbed(
	  "profile",
	  l.title,
	  { fields, lang }
	);

	return await interaction.reply({ embeds: [embed] });
  }

  /**
   * Analyse un message utilisateur et met à jour ses caractéristiques
   * @param {string} userId 
   * @param {string} message 
   */
  _updateCharacteristicsFromMessage(userId, message) {
	// Heuristique simple pour détecter les caractéristiques
	const userMem = this.userMemory?.load(userId);

	// Détecter les émojis/style de parole (simple)
	if (message.includes("!!!") || message.includes("??")) {
	  if (!userMem.characteristics.talkingStyle) {
		userMem.characteristics.talkingStyle = "Expressive and enthusiastic";
	  }
	}

	// Détecter les sujets d'intérêt (keywords très simples)
	const keywords = {
	  "code": "programming",
	  "python": "python",
	  "javascript": "javascript",
	  "art": "art",
	  "music": "music",
	  "game": "gaming",
	  "book": "reading"
	};

	Object.entries(keywords).forEach(([key, topic]) => {
	  if (message.toLowerCase().includes(key)) {
			if (!userMem.characteristics.topics.includes(topic)) {
			  userMem.characteristics.topics.push(topic);
			}
			}
		  });

		  this.userMemory?.save(userId, userMem);
		  }

		  /**
		   * Traite la commande /stats
		   * @param {Interaction} interaction 
		   */
		  async handleStats(interaction) {
			const lang = this.userMemory?.load(interaction.user.id)?.profile?.language || "en";

			const labels = {
			  en: {
				title: "Bot Statistics",
				uptime: "Uptime",
				memory: "Memory Usage",
				guilds: "Guilds",
				users: "Total Users",
				version: "Version"
			  },
			  zh: {
				title: "机器人统计",
				uptime: "在线时间",
				memory: "内存使用",
				guilds: "服务器",
				users: "总用户",
				version: "版本"
			  }
			};

			const l = labels[lang] || labels.en;
			const uptime = Math.floor(this.client.uptime / 1000);
			const hours = Math.floor(uptime / 3600);
			const minutes = Math.floor((uptime % 3600) / 60);

			const fields = [
			  { name: l.uptime, value: `${hours}h ${minutes}m`, inline: true },
			  { name: l.guilds, value: `${this.client.guilds.cache.size}`, inline: true },
			  { name: l.version, value: "0.0.8", inline: true }
			];

			const embed = this.embedBuilder.createCommandEmbed(
			  "stats",
			  l.title,
			  { fields, lang }
			);

			return await interaction.reply({ embeds: [embed] });
		  }

		  /**
		   * Traite la commande /info
		   * @param {Interaction} interaction 
		   */
		  async handleInfo(interaction) {
			const lang = this.userMemory?.load(interaction.user.id)?.profile?.language || "en";

			const messages = {
			  en: `I'm ${this.brand.bot}, a Discord AI assistant powered by OpenRouter's Tencent Hy3 model.

		I can:
		• Chat with you using AI
		• Remember your preferences and conversation history
		• Respond in English and Chinese
		• Use slash commands in any server

		Visit /help for all commands!`,
			  zh: `我是 ${this.brand.bot}，一个由 OpenRouter 的 Tencent Hy3 模型提供支持的 Discord AI 助手。

		我可以：
		• 与你聊天
		• 记住你的偏好和对话历史
		• 用英文和中文回复
		• 在任何服务器中使用斜杠命令

		访问 /help 查看所有命令！`
			};

			const embed = this.embedBuilder.createSimpleEmbed(
			  this.brand.bot,
			  messages[lang] || messages.en,
			  lang
			);

			return await interaction.reply({ embeds: [embed] });
		  }

		  /**
		   * Traite la commande /clear-memory
		   * @param {Interaction} interaction 
		   */
		  async handleClearMemory(interaction) {
			const userMem = this.userMemory?.load(interaction.user.id);
			const lang = userMem?.profile?.language || "en";

			const labels = {
			  en: {
				title: "Memory Cleared",
				message: "Your memory data has been cleared. We'll start fresh!"
			  },
			  zh: {
				title: "记忆已清除",
				message: "您的记忆数据已被清除。我们将重新开始！"
			  }
			};

			const l = labels[lang] || labels.en;

			this.userMemory?.clear(interaction.user.id);

			const embed = this.embedBuilder.createSuccessEmbed(
			  l.message,
			  l.title,
			  lang
			);

			return await interaction.reply({ embeds: [embed] });
		  }

		  /**
		   * Traite la commande /lang
		   * @param {Interaction} interaction 
		   */
		  async handleSetLanguage(interaction) {
			const language = interaction.options.getString("language").toLowerCase();

			if (!["en", "zh"].includes(language)) {
			  const embed = this.embedBuilder.createErrorEmbed(
				"Language must be 'en' (English) or 'zh' (Chinese)",
				"en"
			  );
			  return await interaction.reply({ embeds: [embed], ephemeral: true });
			}

			const userMem = this.userMemory?.load(interaction.user.id);
			userMem.profile.language = language;
			this.userMemory?.save(interaction.user.id, userMem);

			const messages = {
			  en: language === "en" 
				? "Your language has been set to English."
				: "Your language has been set to English. (Switching to English now)",
			  zh: language === "zh"
				? "您的语言已设置为中文。"
				: "您的语言已设置为中文。(现在切换到中文)"
			};

			const lang = userMem.profile.language;
			const embed = this.embedBuilder.createSuccessEmbed(
			  messages[lang] || messages.en,
			  "Language Updated",
			  lang
			);

			return await interaction.reply({ embeds: [embed] });
		  }

		  /**
		   * Traite la commande /feedback
		   * @param {Interaction} interaction 
		   */
		  async handleFeedback(interaction) {
			const feedback = interaction.options.getString("message");
			const userMem = this.userMemory?.load(interaction.user.id);
			const lang = userMem?.profile?.language || "en";

			// Enregistrer le feedback dans les notes
			this.userMemory?.updateCharacteristics(interaction.user.id, {
			  notes: `[Feedback] ${feedback}`
			});

			const messages = {
			  en: "Thank you for your feedback! It helps us improve.",
			  zh: "感谢您的反馈！它帮助我们改进。"
			};

			const embed = this.embedBuilder.createSuccessEmbed(
			  messages[lang] || messages.en,
			  lang === "zh" ? "感谢!" : "Thank you!",
			  lang
			);

			return await interaction.reply({ embeds: [embed] });
		  }
		}

		module.exports = InteractionHandler;
