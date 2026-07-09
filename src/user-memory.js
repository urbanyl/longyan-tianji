const fs = require("fs");
const path = require("path");

class UserMemory {
  constructor(memoryDir = "./data/user-memory") {
	this.memoryDir = memoryDir;

	// Créer le répertoire s'il n'existe pas
	if (!fs.existsSync(this.memoryDir)) {
	  fs.mkdirSync(this.memoryDir, { recursive: true });
	}
  }

  /**
   * Obtient le chemin du fichier mémoire pour un utilisateur
   * @param {string} userId - ID Discord de l'utilisateur
   * @returns {string} Chemin du fichier
   */
  _getFilePath(userId) {
	return path.join(this.memoryDir, `${userId}.json`);
  }

  /**
   * Charge la mémoire d'un utilisateur
   * @param {string} userId - ID Discord de l'utilisateur
   * @returns {Object} Données de mémoire ou objet vide
   */
  load(userId) {
	try {
	  const filePath = this._getFilePath(userId);
	  if (fs.existsSync(filePath)) {
		const data = fs.readFileSync(filePath, "utf-8");
		return JSON.parse(data);
	  }
	} catch (error) {
	  console.error(`Error loading memory for user ${userId}:`, error);
	}

	// Retourner structure par défaut
	return this._createDefaultMemory(userId);
  }

  /**
   * Crée une structure de mémoire par défaut
   * @param {string} userId - ID Discord de l'utilisateur
   * @returns {Object}
   */
  _createDefaultMemory(userId) {
	return {
	  userId: userId,
	  createdAt: new Date().toISOString(),
	  lastUpdated: new Date().toISOString(),
	  profile: {
		username: null,
		language: "en", // "en" ou "zh"
		preferences: {}
	  },
	  conversationHistory: [], // Pour garder le contexte
	  characteristics: {
		talkingStyle: "", // Description du style de parole
		likes: [], // Ce que l'utilisateur aime
		dislikes: [], // Ce que l'utilisateur n'aime pas
		topics: [], // Sujets d'intérêt
		personality: "" // Traits de personnalité détectés
	  },
	  interactions: {
		totalMessages: 0,
		totalInteractions: 0,
		firstInteraction: null,
		lastInteraction: null,
		messageLog: [] // Log des 100 derniers messages
	  },
	  notes: [] // Notes libres sur l'utilisateur
	};
  }

  /**
   * Sauvegarde la mémoire d'un utilisateur
   * @param {string} userId - ID Discord de l'utilisateur
   * @param {Object} memory - Les données à sauvegarder
   */
  save(userId, memory) {
	try {
	  memory.lastUpdated = new Date().toISOString();
	  const filePath = this._getFilePath(userId);
	  fs.writeFileSync(filePath, JSON.stringify(memory, null, 2));
	} catch (error) {
	  console.error(`Error saving memory for user ${userId}:`, error);
	}
  }

  /**
   * Ajoute un message à l'historique de conversation
   * @param {string} userId 
   * @param {string} role - "user" ou "assistant"
   * @param {string} content 
   */
  addMessage(userId, role, content) {
	const memory = this.load(userId);

	// Limiter l'historique à 50 messages (environ 25 échanges)
	if (memory.conversationHistory.length >= 50) {
	  memory.conversationHistory = memory.conversationHistory.slice(-49);
	}

	memory.conversationHistory.push({
	  role: role,
	  content: content,
	  timestamp: new Date().toISOString()
	});

	this.save(userId, memory);
  }

  /**
   * Obtient l'historique de conversation formaté pour OpenRouter
   * @param {string} userId 
   * @returns {Array} Messages au format OpenRouter
   */
  getConversationHistory(userId) {
	const memory = this.load(userId);
	return memory.conversationHistory.map(msg => ({
	  role: msg.role,
	  content: msg.content
	}));
  }

  /**
   * Enregistre une interaction utilisateur
   * @param {string} userId 
   * @param {Object} interaction - { type: "message"|"command", content, metadata }
   */
  recordInteraction(userId, interaction) {
	const memory = this.load(userId);

	memory.interactions.totalInteractions++;
	memory.interactions.lastInteraction = new Date().toISOString();

	if (!memory.interactions.firstInteraction) {
	  memory.interactions.firstInteraction = new Date().toISOString();
	}

	// Ajouter au log des messages (max 100)
	memory.interactions.messageLog.push({
	  timestamp: new Date().toISOString(),
	  type: interaction.type,
	  content: interaction.content.substring(0, 200), // Limiter à 200 chars
	  metadata: interaction.metadata || {}
	});

	if (memory.interactions.messageLog.length > 100) {
	  memory.interactions.messageLog = memory.interactions.messageLog.slice(-99);
	}

	memory.interactions.totalMessages++;
	this.save(userId, memory);
  }

  /**
   * Met à jour les caractéristiques de l'utilisateur
   * @param {string} userId 
   * @param {Object} updates - { talkingStyle, likes, dislikes, topics, personality, etc }
   */
  updateCharacteristics(userId, updates) {
	const memory = this.load(userId);

	if (updates.talkingStyle) {
	  memory.characteristics.talkingStyle = updates.talkingStyle;
	}

	if (updates.likes) {
	  memory.characteristics.likes = [
		...new Set([...memory.characteristics.likes, ...updates.likes])
	  ].slice(0, 50); // Limiter à 50
	}

	if (updates.dislikes) {
	  memory.characteristics.dislikes = [
		...new Set([...memory.characteristics.dislikes, ...updates.dislikes])
	  ].slice(0, 50);
	}

	if (updates.topics) {
	  memory.characteristics.topics = [
		...new Set([...memory.characteristics.topics, ...updates.topics])
	  ].slice(0, 30);
	}

	if (updates.personality) {
	  memory.characteristics.personality = updates.personality;
	}

	if (updates.notes) {
	  memory.notes.push({
		timestamp: new Date().toISOString(),
		note: updates.notes
	  });
	  if (memory.notes.length > 50) {
		memory.notes = memory.notes.slice(-49);
	  }
	}

	this.save(userId, memory);
  }

  /**
   * Génère un contexte résumé pour le prompt du bot
   * @param {string} userId 
   * @returns {string} Contexte formaté
   */
  getContextSummary(userId) {
	const memory = this.load(userId);
	let summary = "";

	if (memory.characteristics.talkingStyle) {
	  summary += `L'utilisateur parle de cette façon: ${memory.characteristics.talkingStyle}\n`;
	}

	if (memory.characteristics.likes.length > 0) {
	  summary += `L'utilisateur aime: ${memory.characteristics.likes.join(", ")}\n`;
	}

	if (memory.characteristics.dislikes.length > 0) {
	  summary += `L'utilisateur n'aime pas: ${memory.characteristics.dislikes.join(", ")}\n`;
	}

	if (memory.characteristics.topics.length > 0) {
	  summary += `Sujets d'intérêt: ${memory.characteristics.topics.join(", ")}\n`;
	}

	if (memory.characteristics.personality) {
	  summary += `Personnalité détectée: ${memory.characteristics.personality}\n`;
	}

	return summary;
  }

  /**
   * Efface toutes les données d'un utilisateur
   * @param {string} userId 
   */
  clear(userId) {
	try {
	  const filePath = this._getFilePath(userId);
	  if (fs.existsSync(filePath)) {
		fs.unlinkSync(filePath);
	  }
	} catch (error) {
	  console.error(`Error clearing memory for user ${userId}:`, error);
	}
  }

  /**
   * Obtient les statistiques globales
   * @returns {Object} Nombre d'utilisateurs etc
   */
  getStats() {
	try {
	  const files = fs.readdirSync(this.memoryDir);
	  const userCount = files.filter(f => f.endsWith(".json")).length;

	  return {
		totalUsers: userCount,
		memoryDir: this.memoryDir,
		lastUpdated: new Date().toISOString()
	  };
	} catch (error) {
	  console.error("Error getting memory stats:", error);
	  return { totalUsers: 0, error: error.message };
	}
  }
}

module.exports = UserMemory;
