/**
 * Gestionnaire Discord optimisé pour performances
 * Version light et rapide sans latences OpenRouter inutiles
 */

const { EmbedBuilder } = require('discord.js');
const FastResponseSystem = require('./fast-response');
const ModerationManager = require('./moderation-manager');
const UtilityManager = require('./utility-manager');
const FunManager = require('./fun-manager');

class OptimizedDiscordHandler {
  constructor(client, originalHandler) {
    this.client = client;
    this.originalHandler = originalHandler;
    this.config = originalHandler.config;
    this.brand = originalHandler.brand;
    
    // Systèmes optimisés
    this.fastResponse = new FastResponseSystem();
    this.moderation = new ModerationManager(client);
    this.utility = new UtilityManager(client);
    this.fun = new FunManager();
    
    // Commandes rapides
    this.commands = new Map();
    this.registerCommands();
    
    // Cache pour les réponses
    this.responseCache = new Map();
    this.cacheTtl = 60000; // 1 minute
    
    console.log('🔧 Handler optimisé chargé avec commandes rapides');
  }
  
  /**
   * Enregistre toutes les commandes
   */
  registerCommands() {
    // Commandes utilitaires
    this.commands.set('ping', (message, args) => this.utility.ping(message, args));
    this.commands.set('help', (message, args) => this.help(message, args));
    this.commands.set('userinfo', (message, args) => this.utility.userinfo(message, args));
    this.commands.set('serverinfo', (message, args) => this.utility.serverinfo(message, args));
    this.commands.set('avatar', (message, args) => this.utility.avatar(message, args));
    this.commands.set('stats', (message, args) => this.utility.stats(message, args));
    this.commands.set('botinfo', (message, args) => this.utility.botinfo(message, args));
    
    // Commandes de modération
    this.commands.set('kick', (message, args) => this.moderation.kick(message, args));
    this.commands.set('ban', (message, args) => this.moderation.ban(message, args));
    this.commands.set('mute', (message, args) => this.moderation.mute(message, args));
    this.commands.set('warn', (message, args) => this.moderation.warn(message, args));
    this.commands.set('clear', (message, args) => this.moderation.clear(message, args));
    this.commands.set('slowmode', (message, args) => this.moderation.slowmode(message, args));
    this.commands.set('lock', (message, args) => this.moderation.lockUnlock(message, args, true));
    this.commands.set('unlock', (message, args) => this.moderation.lockUnlock(message, args, false));
    
    // Commandes fun
    this.commands.set('8ball', (message, args) => this.fun.eightball(message, args));
    this.commands.set('coinflip', (message, args) => this.fun.coinflip(message, args));
    this.commands.set('dice', (message, args) => this.fun.dice(message, args));
    this.commands.set('rps', (message, args) => this.fun.rps(message, args));
    this.commands.set('joke', (message, args) => this.fun.joke(message, args));
    this.commands.set('fact', (message, args) => this.fun.fact(message, args));
    
    // Alias
    this.commands.set('pong', (message, args) => this.utility.ping(message, args));
    this.commands.set('info', (message, args) => this.utility.botinfo(message, args));
    this.commands.set('clean', (message, args) => this.moderation.clear(message, args));
    this.commands.set('purge', (message, args) => this.moderation.clear(message, args));
  }
  
  /**
   * Gère un message avec optimisation
   */
  async handleMessage(message) {
    if (!message || message.author.bot) return;
    
    // Ignorer les mentions everyone
    if (message.mentions && message.mentions.everyone) return;
    
    const content = message.content || '';
    const prefix = this.brand.prefix;
    
    // Vérifier si c'est une commande avec préfixe
    if (content.startsWith(prefix)) {
      await this.handleCommand(message);
      return;
    }
    
    // Vérifier les mentions
    const mentioned = message.mentions && message.mentions.has && message.mentions.has(this.client.user);
    const calledByName = /\b(tianji|天机)\b/i.test(content);
    
    if (mentioned || calledByName) {
      await this.handleMention(message, content, mentioned, calledByName);
      return;
    }
  }
  
  /**
   * Gère une commande avec préfixe
   */
  async handleCommand(message) {
    const prefix = this.brand.prefix;
    const body = message.content.slice(prefix.length).trim();
    const [name, ...args] = body.split(/\s+/);
    const commandName = (name || '').toLowerCase();
    
    const command = this.commands.get(commandName);
    if (!command) {
      // Si la commande n'existe pas ici, passer au handler original
      return this.originalHandler.handleMessage(message);
    }
    
    try {
      // Vérifier les permissions (simplifié)
      if (this.isModerationCommand(commandName) && !this.checkPermissions(message.member)) {
        return message.reply('❌ Tu n\'as pas les permissions nécessaires.');
      }
      
      // Exécuter la commande
      console.log(`⚡ Commande rapide: ${commandName} par ${message.author.tag}`);
      await command(message, args);
    } catch (error) {
      console.error(`Erreur commande ${commandName}:`, error);
      await message.reply(`❌ Erreur: ${error.message}`).catch(() => {});
    }
  }
  
  /**
   * Gère une mention du bot
   */
  async handleMention(message, content, mentioned, calledByName) {
    // Nettoyer le contenu
    const cleanContent = content
      .replace(new RegExp(`<@!?${this.client.user.id}>`, 'g'), '')
      .replace(/tianji/gi, '')
      .replace(/天机/gi, '')
      .trim();
    
    // Vérifier le cache
    const cacheKey = `${message.author.id}:${cleanContent.toLowerCase()}`;
    const cached = this.responseCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTtl) {
      return message.reply(cached.response);
    }
    
    // Réponses rapides pour mentions simples
    if (!cleanContent || cleanContent.length < 3) {
      const responses = [
        'Oui ?',
        'Besoin d\'aide ?',
        'Que veux-tu ?',
        'Je suis là',
        'Dis-moi'
      ];
      const response = responses[Math.floor(Math.random() * responses.length)];
      this.cacheResponse(cacheKey, response);
      return message.reply(response);
    }
    
    // Vérifier les réponses prédéfinies
    const fastResponse = this.fastResponse.getFastResponse(cleanContent);
    if (fastResponse) {
      this.cacheResponse(cacheKey, fastResponse);
      return message.reply(fastResponse);
    }
    
    // Pour les questions simples
    if (cleanContent.length < 100) {
      const simpleResponse = this.generateSimpleResponse(cleanContent);
      this.cacheResponse(cacheKey, simpleResponse);
      return message.reply(simpleResponse);
    }
    
    // Sinon, laisser le handler original gérer
    return this.originalHandler.handleMessage(message);
  }
  
  /**
   * Génère une réponse simple basée sur le contenu
   */
  generateSimpleResponse(content) {
    const lower = content.toLowerCase();
    
    // Salutations
    if (/(bonjour|salut|hello|hi|hey|yo)/.test(lower)) {
      return 'Salut';
    }
    
    if (/(bonsoir|bonne soirée)/.test(lower)) {
      return 'Bonsoir';
    }
    
    // Questions sur le bot
    if (/(qui (es|est)-tu|who are you)/.test(lower)) {
      return 'Je suis Tianji, un bot Discord optimisé. Utilise !help pour voir mes commandes.';
    }
    
    if (/(que fais-tu|what do you do)/.test(lower)) {
      return 'J\'aide avec la modération, les utilitaires et le divertissement.';
    }
    
    // Demandes d'aide
    if (/(aide|help|commande)/.test(lower)) {
      return 'Utilise `!help` pour voir toutes mes commandes.';
    }
    
    // Merci
    if (/(merci|thanks|thank you)/.test(lower)) {
      return 'De rien';
    }
    
    // Questions oui/non
    if (/(ça va|comment ça va|how are you)/.test(lower)) {
      return 'Ça va bien, et toi ?';
    }
    
    // Réponses génériques
    const genericResponses = [
      'Je vois',
      'D\'accord',
      'Intéressant',
      'Continue',
      'Parfait',
      'Compris'
    ];
    
    return genericResponses[Math.floor(Math.random() * genericResponses.length)];
  }
  
  /**
   * Met en cache une réponse
   */
  cacheResponse(key, response) {
    this.responseCache.set(key, {
      response,
      timestamp: Date.now()
    });
    
    // Nettoyer le cache si trop grand
    if (this.responseCache.size > 100) {
      const oldestKey = Array.from(this.responseCache.keys())[0];
      this.responseCache.delete(oldestKey);
    }
  }
  
  /**
   * Vérifie si c'est une commande de modération
   */
  isModerationCommand(commandName) {
    const modCommands = ['kick', 'ban', 'mute', 'warn', 'clear', 'slowmode', 'lock', 'unlock', 'purge'];
    return modCommands.includes(commandName);
  }
  
  /**
   * Vérifie les permissions simplifiées
   */
  checkPermissions(member) {
    if (!member) return false;
    
    // Permissions de base
    const hasKick = member.permissions.has('KickMembers');
    const hasBan = member.permissions.has('BanMembers');
    const hasManageMessages = member.permissions.has('ManageMessages');
    const hasManageChannels = member.permissions.has('ManageChannels');
    
    return hasKick || hasBan || hasManageMessages || hasManageChannels;
  }
  
  /**
   * Commande d'aide optimisée
   */
  async help(message, args) {
    const category = args[0]?.toLowerCase();
    const p = this.brand.prefix;
    
    if (category === 'mod') {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('🛡️ Commandes de modération')
        .setDescription([
          `${p}kick @user [raison] - Expulse un membre`,
          `${p}ban @user [jours] [raison] - Bannit un membre`,
          `${p}mute @user [durée] [raison] - Rend muet un membre`,
          `${p}warn @user [raison] - Avertit un membre`,
          `${p}clear [nombre] - Supprime des messages (1-100)`,
          `${p}slowmode [secondes] - Active le slowmode`,
          `${p}lock - Verrouille un salon`,
          `${p}unlock - Déverrouille un salon`
        ].join('\n'))
        .setFooter({ text: `Demandé par ${message.author.tag}` });
      
      return message.reply({ embeds: [embed] });
    }
    
    if (category === 'util') {
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('🔧 Commandes utilitaires')
        .setDescription([
          `${p}userinfo @user - Infos sur un utilisateur`,
          `${p}serverinfo - Infos sur le serveur`,
          `${p}avatar @user - Affiche l\'avatar`,
          `${p}stats - Affiche les statistiques du bot`,
          `${p}botinfo - Informations sur le bot`,
          `${p}ping - Vérifie la latence`,
          `${p}help [catégorie] - Affiche l'aide`
        ].join('\n'))
        .setFooter({ text: `Demandé par ${message.author.tag}` });
      
      return message.reply({ embeds: [embed] });
    }
    
    if (category === 'fun') {
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🎮 Commandes fun')
        .setDescription([
          `${p}8ball [question] - Boule magique`,
          `${p}coinflip - Lance une pièce`,
          `${p}dice [faces] - Lance un dé`,
          `${p}rps [pierre|papier|ciseaux] - Pierre papier ciseaux`,
          `${p}joke - Racconte une blague`,
          `${p}fact - Donne un fait intéressant`
        ].join('\n'))
        .setFooter({ text: `Demandé par ${message.author.tag}` });
      
      return message.reply({ embeds: [embed] });
    }
    
    // Aide générale
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🤖 Commandes disponibles')
      .setDescription([
        `**${this.brand.bot} - Bot optimisé**`,
        '',
        `• \`${p}help mod\` - Commandes de modération`,
        `• \`${p}help util\` - Commandes utilitaires`,
        `• \`${p}help fun\` - Commandes fun`,
        '',
        '**Réponses rapides:**',
        '• Mentionne-moi pour une réponse instantanée',
        '• Pas de latence, pas d\'emojis inutiles',
        '• Réponses directes et concises',
        '',
        '**Optimisations:**',
        '• Cache des réponses fréquentes',
        '• Pas de mentions "je suis une IA"',
        '• Réponses en moins de 100ms'
      ].join('\n'))
      .setFooter({ text: `Version optimisée | Demandé par ${message.author.tag}` });
    
    return message.reply({ embeds: [embed] });
  }
  
  /**
   * Nettoie périodiquement le cache
   */
  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.responseCache.entries()) {
      if (now - value.timestamp > this.cacheTtl) {
        this.responseCache.delete(key);
      }
    }
  }
}

module.exports = OptimizedDiscordHandler;