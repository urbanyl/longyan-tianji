class ChatManager {
  constructor(userMemory, openrouter, embedBuilder) {
	this.userMemory = userMemory;
	this.openrouter = openrouter;
	this.embedBuilder = embedBuilder;

	// Configuration du système de chat
	this.systemPrompts = {
	  en: "You are an impartial, factual agent called the assistant. You remember conversations and adapt to the user's style. Never state or imply you are an AI. Refer to yourself as an agent. Never express emotions, feelings, or personal opinions. Be concise, neutral, and provide direct useful answers quickly.",
	  zh: "你是一个公正、以事实为准的代理（agent）。你记得对话并适应用户的风格。绝不自称或暗示自己是人工智能。以“代理”自称。绝不表达情绪、感受或个人观点。回答简洁、中立、直接并尽快返回有用信息。"
	};
  }

  /**
   * Traite un message de chat avec gestion du contexte
   * @param {string} userId - ID utilisateur Discord
   * @param {string} message - Message utilisateur
   * @param {string} lang - Langue préférée (en/zh)
   * @returns {Promise<Object>} Réponse et métadonnées
   */
  async chat(userId, message, lang = "en") {
	try {
	  // Charger la mémoire utilisateur
	  const userMem = this.userMemory.load(userId);

	  // Mettre à jour la langue si demandé
	  if (lang) {
		userMem.profile.language = lang;
	  }

	  // Enregistrer l'interaction
	  this.userMemory.recordInteraction(userId, {
		type: "chat",
		content: message
	  });

	  // Obtenir l'historique de conversation
	  const conversationHistory = userMem.conversationHistory.map(msg => ({
		role: msg.role,
		content: msg.content
	  })) || [];

	  // Construire le contexte utilisateur
	  const contextSummary = this._buildUserContext(userMem, lang);

	  // Construire les messages avec prompt système
	  const systemPrompt = this._buildSystemPrompt(lang, contextSummary);

	  const messages = [
		{ role: "system", content: systemPrompt },
		...conversationHistory,
		{ role: "user", content: message }
	  ];

	  // Appeler OpenRouter avec streaming
	  const response = await this.openrouter.chatWithStreaming(message, messages.slice(1)); // Exclure le system prompt pour OpenRouter

	  // Analyser la réponse pour les caractéristiques
	  this._analyzeAndUpdateCharacteristics(userId, message, response.content);

	  // Sauvegarder l'échange
	  this.userMemory.addMessage(userId, "user", message);
	  this.userMemory.addMessage(userId, "assistant", response.content);

	  return {
		content: response.content,
		usage: response.usage,
		model: response.model,
		language: lang
	  };
	} catch (error) {
	  console.error("Chat error:", error);
	  throw error;
	}
  }

  /**
   * Construit le prompt système avec le contexte utilisateur
   * @param {string} lang 
   * @param {string} contextSummary 
   * @returns {string}
   */
  _buildSystemPrompt(lang = "en", contextSummary = "") {
	let prompt = this.systemPrompts[lang] || this.systemPrompts.en;

	if (contextSummary) {
	  prompt += `\n\nAbout this user:\n${contextSummary}`;
	}

	return prompt;
  }

  /**
   * Construit le contexte utilisateur basé sur sa mémoire
   * @param {Object} userMem 
   * @param {string} lang 
   * @returns {string}
   */
  _buildUserContext(userMem, lang = "en") {
	const parts = [];

	if (userMem.characteristics.talkingStyle) {
	  parts.push(`Talking style: ${userMem.characteristics.talkingStyle}`);
	}

	if (userMem.characteristics.personality) {
	  parts.push(`Personality: ${userMem.characteristics.personality}`);
	}

	if (userMem.characteristics.topics.length > 0) {
	  parts.push(`Interests: ${userMem.characteristics.topics.join(", ")}`);
	}

	if (userMem.characteristics.likes.length > 0) {
	  parts.push(`Likes: ${userMem.characteristics.likes.join(", ")}`);
	}

	if (userMem.characteristics.dislikes.length > 0) {
	  parts.push(`Dislikes: ${userMem.characteristics.dislikes.join(", ")}`);
	}

	if (userMem.notes.length > 0) {
	  const recentNotes = userMem.notes.slice(-3).map(n => n.note).join("; ");
	  parts.push(`Recent notes: ${recentNotes}`);
	}

	return parts.join("\n");
  }

  /**
   * Analyse et met à jour les caractéristiques utilisateur
   * @param {string} userId 
   * @param {string} userMessage 
   * @param {string} aiResponse 
   */
  _analyzeAndUpdateCharacteristics(userId, userMessage, aiResponse) {
	const userMem = this.userMemory.load(userId);
	const updates = {};

	// Analyser le style de parole
	const exclamationCount = (userMessage.match(/!/g) || []).length;
	const questionCount = (userMessage.match(/\?/g) || []).length;
	const hasEmotion = /[❤😊😂😭🥰😍😎🔥]/g.test(userMessage);

	if (exclamationCount > 1 || hasEmotion) {
	  updates.talkingStyle = "Enthusiastic and expressive";
	} else if (questionCount > 1) {
	  updates.talkingStyle = "Curious and inquisitive";
	}

	// Détecter les topics d'intérêt (simple keyword matching)
	const topicKeywords = {
	  "code|programming|python|javascript|java|c++": "programming",
	  "ai|machine learning|neural": "AI",
	  "game|gaming|esports": "gaming",
	  "music|song|album|artist": "music",
	  "art|paint|draw|design": "art",
	  "book|reading|author|novel": "reading",
	  "movie|film|cinema|actor": "movies",
	  "sport|football|soccer|basketball": "sports",
	  "travel|trip|vacation|world": "travel",
	  "food|cook|restaurant|recipe": "food",
	  "science|physics|chemistry|biology": "science"
	};

	for (const [pattern, topic] of Object.entries(topicKeywords)) {
	  const regex = new RegExp(pattern, "gi");
	  if (regex.test(userMessage)) {
		if (!updates.topics) updates.topics = [];
		updates.topics.push(topic);
	  }
	}

	// Remove duplicates
	if (updates.topics) {
	  updates.topics = [...new Set(updates.topics)];
	}

	if (Object.keys(updates).length > 0) {
	  this.userMemory.updateCharacteristics(userId, updates);
	}
  }

  /**
   * Obtient le résumé de la mémoire utilisateur
   * @param {string} userId 
   * @returns {Object}
   */
  getMemorySummary(userId) {
	const userMem = this.userMemory.load(userId);
	return {
	  totalInteractions: userMem.interactions.totalInteractions,
	  totalMessages: userMem.interactions.totalMessages,
	  conversationLength: userMem.conversationHistory.length,
	  talkingStyle: userMem.characteristics.talkingStyle || "Not yet analyzed",
	  personality: userMem.characteristics.personality || "Not yet analyzed",
	  topics: userMem.characteristics.topics,
	  firstSeen: userMem.interactions.firstInteraction,
	  lastSeen: userMem.interactions.lastInteraction
	};
  }

  /**
   * Efface la mémoire d'un utilisateur
   * @param {string} userId 
   */
  clearMemory(userId) {
	this.userMemory.clear(userId);
  }

  /**
   * Export la mémoire d'un utilisateur (pour sauvegarde)
   * @param {string} userId 
   * @returns {Object}
   */
  exportMemory(userId) {
	return this.userMemory.load(userId);
  }

  /**
   * Import la mémoire d'un utilisateur
   * @param {string} userId 
   * @param {Object} memoryData 
   */
  importMemory(userId, memoryData) {
	this.userMemory.save(userId, memoryData);
  }
}

module.exports = ChatManager;
