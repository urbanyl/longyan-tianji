/**
 * Système de réponse rapide avec cache et réponses prédéfinies
 * Pour optimiser les temps de réponse et éviter les appels API inutiles
 */

class FastResponseSystem {
  constructor() {
    // Cache pour les réponses fréquentes
    this.cache = new Map();
    this.cacheTtl = 300000; // 5 minutes
    this.maxCacheSize = 1000;

    // Réponses prédéfinies pour les patterns communs
    this.patternResponses = new Map([
      // Patterns de salutation
      [/^(bonjour|salut|hello|hey|hi|yo)\s*$/i, "Salut"],
      [/^(bonsoir|bonne soirée)\s*$/i, "Bonsoir"],
      [/^(bonne nuit|good night)\s*$/i, "Bonne nuit"],
      
      // Patterns de politesse
      [/^(merci|thanks|thank you)\s*$/i, "De rien"],
      [/^(s'il te plaît|please)\s*$/i, "Bien sûr"],
      [/^(désolé|sorry)\s*$/i, "Pas de problème"],
      
      // Questions simples
      [/^(ça va\??|comment ça va\??|how are you\??)\s*$/i, "Ça va bien, et toi ?"],
      [/^(qui (es|est)-tu\??|who are you\??)\s*$/i, "Je suis Tianji, un bot Discord optimisé"],
      [/^(que fais-tu\??|what do you do\??)\s*$/i, "J'aide les utilisateurs avec diverses commandes"],
      [/^(aide|help|commande|commands)\s*$/i, "Utilise !help pour voir toutes les commandes"],
      [/^(ping|latence)\s*$/i, "pong"],
      
      // Réponses simples
      [/^(oui|yes|ouais)\s*$/i, "D'accord"],
      [/^(non|no)\s*$/i, "Compris"],
      [/^(ok|okay|d'accord)\s*$/i, "Parfait"],
      [/^(cool|nice|génial)\s*$/i, "Merci"],
      
      // Patterns chinois
      [/^(你好|哈喽|嗨)\s*$/i, "你好"],
      [/^(谢谢|多谢)\s*$/i, "不客气"],
      [/^(对不起|抱歉)\s*$/i, "没关系"],
      [/^(你是?谁|你是谁)\s*$/i, "我是龙炎天机，一个优化了的 Discord 机器人"],
    ]);

    // Réponses pour mentions
    this.mentionResponses = [
      "Oui ?",
      "Que veux-tu ?",
      "Je suis là",
      "Besoin d'aide ?",
      "Prêt à aider",
      "Dis-moi"
    ];

    this.commandsHelp = {
      mod: [
        "!kick @user [raison] - Expulse un membre",
        "!ban @user [raison] - Bannit un membre", 
        "!mute @user [durée] [raison] - Rend muet un membre",
        "!warn @user [raison] - Avertit un membre",
        "!clear [nombre] - Supprime des messages",
        "!slowmode [secondes] - Active le slowmode",
        "!lock - Verrouille un salon",
        "!unlock - Déverrouille un salon"
      ],
      util: [
        "!help - Affiche l'aide",
        "!ping - Vérifie la latence",
        "!stats - Affiche les statistiques",
        "!userinfo @user - Infos sur un utilisateur",
        "!serverinfo - Infos sur le serveur",
        "!avatar @user - Affiche l'avatar",
        "!roleinfo @role - Infos sur un rôle",
        "!poll [question] - Crée un sondage"
      ],
      fun: [
        "!8ball [question] - Pose une question",
        "!coinflip - Lance une pièce",
        "!dice - Lance un dé",
        "!rps [pierre|papier|ciseaux] - Pierre papier ciseaux",
        "!meme - Génère un meme",
        "!joke - Racconte une blague",
        "!fact - Donne un fait intéressant",
        "!quote - Citation aléatoire"
      ]
    };
  }

  /**
   * Vérifie si un message correspond à un pattern de réponse rapide
   * @param {string} message 
   * @returns {string|null} Réponse rapide ou null
   */
  getFastResponse(message) {
    if (!message || typeof message !== 'string') return null;
    
    const trimmed = message.trim().toLowerCase();
    
    // Vérifier le cache d'abord
    const cached = this.cache.get(trimmed);
    if (cached && Date.now() - cached.timestamp < this.cacheTtl) {
      return cached.response;
    }
    
    // Vérifier les patterns
    for (const [pattern, response] of this.patternResponses) {
      if (pattern.test(trimmed)) {
        // Mettre en cache
        this.updateCache(trimmed, response);
        return response;
      }
    }
    
    return null;
  }

  /**
   * Met à jour le cache
   */
  updateCache(key, response) {
    // Gestion de la taille du cache
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = Array.from(this.cache.keys())[0];
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      response,
      timestamp: Date.now()
    });
  }

  /**
   * Nettoie le cache expiré
   */
  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTtl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Obtient une réponse pour une mention
   */
  getMentionResponse() {
    const index = Math.floor(Math.random() * this.mentionResponses.length);
    return this.mentionResponses[index];
  }

  /**
   * Génère une réponse d'aide par catégorie
   */
  getHelpResponse(category = 'all') {
    let response = "**📋 Commandes disponibles:**\n\n";
    
    if (category === 'all' || category === 'mod') {
      response += "**🛡️ Modération:**\n" + this.commandsHelp.mod.join('\n') + "\n\n";
    }
    if (category === 'all' || category === 'util') {
      response += "**🔧 Utilitaires:**\n" + this.commandsHelp.util.join('\n') + "\n\n";
    }
    if (category === 'all' || category === 'fun') {
      response += "**🎮 Fun:**\n" + this.commandsHelp.fun.join('\n') + "\n\n";
    }
    
    response += "Utilise `!help [mod|util|fun]` pour une catégorie spécifique.";
    return response;
  }

  /**
   * Vérifie si le message nécessite une réponse rapide
   */
  shouldRespondFast(messageContent, isMentioned = false) {
    if (!messageContent) return false;
    
    const content = messageContent.toLowerCase().trim();
    
    // Toujours répondre aux mentions directes
    if (isMentioned) return true;
    
    // Répondre aux messages courts (< 15 caractères)
    if (content.length < 15) {
      return this.getFastResponse(content) !== null;
    }
    
    return false;
  }

  /**
   * Formate une réponse simple sans emojis inutiles
   */
  formatResponse(text) {
    // Retirer les emojis et expressions trop "IA"
    const cleaned = text
      .replace(/😄|😊|✨|🌟|💫|🎉|🤖/g, '') // Retirer emojis communs
      .replace(/I am an AI assistant|Je suis une intelligence artificielle|I'm an AI/gi, '')
      .replace(/How can I help you today\??/gi, '')
      .replace(/Comment puis-je vous aider aujourd'hui\??/gi, '')
      .trim();
    
    return cleaned || text;
  }
}

module.exports = FastResponseSystem;