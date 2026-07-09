const { OpenRouter } = require("@openrouter/sdk");

class OpenRouterHandler {
  constructor(apiKey) {
	if (!apiKey) {
	  throw new Error("OPENROUTER_API_KEY is required for chat mode");
	}
	this.openrouter = new OpenRouter({
	  apiKey: apiKey
	});
	this.model = "tencent/hy3:free";
  }

  /**
   * Envoie un message à OpenRouter avec streaming
   * @param {string} userMessage - Le message de l'utilisateur
   * @param {Array} conversationHistory - L'historique de la conversation
   * @returns {Promise<Object>} Réponse avec contenu et tokens
   */
  async chatWithStreaming(userMessage, conversationHistory = []) {
	try {
	  // Préparer les messages
	  const messages = [
		...conversationHistory,
		{
		  role: "user",
		  content: userMessage
		}
	  ];

	  // Activer le stream
	  const stream = await this.openrouter.chat.send({
		model: this.model,
		messages: messages,
		temperature: 0.7,
		top_p: 0.9,
		stream: true
	  });

	  let response = "";
	  let usage = null;

	  // Lire le stream
	  for await (const chunk of stream) {
		const content = chunk.choices[0]?.delta?.content;
		if (content) {
		  response += content;
		}

		// Capturer les infos d'utilisation du dernier chunk
		if (chunk.usage) {
		  usage = chunk.usage;
		}
	  }

	  return {
		content: response,
		usage: usage,
		model: this.model
	  };
	} catch (error) {
	  console.error("OpenRouter API Error:", error);
	  throw new Error(`OpenRouter API Error: ${error.message}`);
	}
  }

  /**
   * Envoie un message simple à OpenRouter (non-streaming)
   * @param {string} userMessage - Le message de l'utilisateur
   * @param {Array} conversationHistory - L'historique de la conversation
   * @returns {Promise<string>} La réponse du modèle
   */
  async chat(userMessage, conversationHistory = []) {
	const result = await this.chatWithStreaming(userMessage, conversationHistory);
	return result.content;
  }

  /**
   * Envoie un message avec un callback pour le streaming temps réel
   * Utile pour les Discord interactions
   * @param {string} userMessage - Le message de l'utilisateur
   * @param {Function} onChunk - Callback appelé pour chaque chunk reçu
   * @param {Array} conversationHistory - L'historique de la conversation
   * @returns {Promise<Object>} Réponse complète
   */
  async chatWithCallback(userMessage, onChunk, conversationHistory = []) {
	try {
	  const messages = [
		...conversationHistory,
		{
		  role: "user",
		  content: userMessage
		}
	  ];

	  const stream = await this.openrouter.chat.send({
		model: this.model,
		messages: messages,
		temperature: 0.7,
		top_p: 0.9,
		stream: true
	  });

	  let response = "";
	  let usage = null;

	  for await (const chunk of stream) {
		const content = chunk.choices[0]?.delta?.content;
		if (content) {
		  response += content;
		  if (onChunk) {
			await onChunk(content);
		  }
		}

		if (chunk.usage) {
		  usage = chunk.usage;
		}
	  }

	  return {
		content: response,
		usage: usage,
		model: this.model
	  };
	} catch (error) {
	  console.error("OpenRouter API Error:", error);
	  throw new Error(`OpenRouter API Error: ${error.message}`);
	}
  }

  /**
   * Vérifie la connexion à l'API
   * @returns {Promise<boolean>}
   */
  async testConnection() {
	try {
	  await this.openrouter.chat.send({
		model: this.model,
		messages: [{ role: "user", content: "test" }],
		stream: false
	  });
	  return true;
	} catch {
	  return false;
	}
  }
}

module.exports = OpenRouterHandler;
