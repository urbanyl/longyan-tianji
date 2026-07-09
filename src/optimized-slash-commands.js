/**
 * Slash commands optimisés pour performance
 * Commandes rapides sans latence inutile
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

class OptimizedSlashCommands {
  constructor() {
    this.commands = [];
    this.buildCommands();
  }
  
  /**
   * Construit les slash commands optimisés
   */
  buildCommands() {
    // Commande /ping optimisée
    this.commands.push(
      new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Vérifie la latence du bot (optimisé)')
        .setDMPermission(true)
    );
    
    // Commande /help optimisée
    this.commands.push(
      new SlashCommandBuilder()
        .setName('help')
        .setDescription('Affiche l\'aide des commandes')
        .addStringOption(option =>
          option.setName('category')
            .setDescription('Catégorie d\'aide')
            .setRequired(false)
            .addChoices(
              { name: 'Modération', value: 'mod' },
              { name: 'Utilitaires', value: 'util' },
              { name: 'Fun', value: 'fun' }
            )
        )
        .setDMPermission(true)
    );
    
    // Commande /stats optimisée
    this.commands.push(
      new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Affiche les statistiques du bot')
        .setDMPermission(true)
    );
    
    // Commande /userinfo
    this.commands.push(
      new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Informations sur un utilisateur')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('Utilisateur cible')
            .setRequired(false)
        )
        .setDMPermission(true)
    );
    
    // Commande /serverinfo
    this.commands.push(
      new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Informations sur le serveur')
        .setDMPermission(false)
    );
    
    // Commande /avatar
    this.commands.push(
      new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Affiche l\'avatar d\'un utilisateur')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('Utilisateur cible')
            .setRequired(false)
        )
        .setDMPermission(true)
    );
    
    // Commande /botinfo
    this.commands.push(
      new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('Informations sur le bot')
        .setDMPermission(true)
    );
    
    // Commande /clear (modération)
    this.commands.push(
      new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Supprime des messages')
        .addIntegerOption(option =>
          option.setName('amount')
            .setDescription('Nombre de messages à supprimer (1-100)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .setDMPermission(false)
    );
    
    // Commande /kick (modération)
    this.commands.push(
      new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Expulse un membre')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('Membre à expulser')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('Raison de l\'expulsion')
            .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .setDMPermission(false)
    );
    
    // Commande /8ball (fun)
    this.commands.push(
      new SlashCommandBuilder()
        .setName('8ball')
        .setDescription('Pose une question à la boule magique')
        .addStringOption(option =>
          option.setName('question')
            .setDescription('Ta question')
            .setRequired(true)
        )
        .setDMPermission(true)
    );
  }
  
  /**
   * Obtient tous les slash commands
   */
  getCommands() {
    return this.commands;
  }
  
  /**
   * Obtient les commandes au format JSON pour Discord
   */
  toJSON() {
    return this.commands.map(cmd => cmd.toJSON());
  }
  
  /**
   * Gère une interaction slash command
   */
  async handleInteraction(interaction, client) {
    if (!interaction.isChatInputCommand()) return;
    
    const { commandName } = interaction;
    
    try {
      switch (commandName) {
        case 'ping':
          await this.handlePing(interaction, client);
          break;
          
        case 'help':
          await this.handleHelp(interaction);
          break;
          
        case 'stats':
          await this.handleStats(interaction, client);
          break;
          
        case 'userinfo':
          await this.handleUserInfo(interaction);
          break;
          
        case 'serverinfo':
          await this.handleServerInfo(interaction);
          break;
          
        case 'avatar':
          await this.handleAvatar(interaction);
          break;
          
        case 'botinfo':
          await this.handleBotInfo(interaction, client);
          break;
          
        case 'clear':
          await this.handleClear(interaction);
          break;
          
        case 'kick':
          await this.handleKick(interaction);
          break;
          
        case '8ball':
          await this.handleEightBall(interaction);
          break;
          
        default:
          await interaction.reply({
            content: 'Commande non reconnue',
            ephemeral: true
          });
      }
    } catch (error) {
      console.error(`Erreur slash command ${commandName}:`, error);
      await interaction.reply({
        content: `Erreur: ${error.message}`,
        ephemeral: true
      }).catch(() => {});
    }
  }
  
  /**
   * Gère /ping
   */
  async handlePing(interaction, client) {
    const latency = Date.now() - interaction.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);
    
    await interaction.reply({
      content: `🏓 Pong!\nLatence: ${latency}ms\nAPI: ${apiLatency}ms`,
      ephemeral: true
    });
  }
  
  /**
   * Gère /help
   */
  async handleHelp(interaction) {
    const category = interaction.options.getString('category');
    
    let content = '**🤖 Commandes slash optimisées**\n\n';
    
    if (!category) {
      content += '• `/ping` - Vérifie la latence\n';
      content += '• `/help [catégorie]` - Affiche cette aide\n';
      content += '• `/stats` - Statistiques du bot\n';
      content += '• `/userinfo [utilisateur]` - Infos utilisateur\n';
      content += '• `/serverinfo` - Infos serveur\n';
      content += '• `/avatar [utilisateur]` - Affiche l\'avatar\n';
      content += '• `/botinfo` - Informations sur le bot\n';
      content += '• `/clear [nombre]` - Supprime des messages\n';
      content += '• `/kick [utilisateur]` - Expulse un membre\n';
      content += '• `/8ball [question]` - Boule magique\n\n';
      content += '**Commandes prefix:** Utilise `!` pour les commandes textuelles';
    } else if (category === 'mod') {
      content += '**🛡️ Modération:**\n';
      content += '• `/clear [nombre]` - Supprime des messages\n';
      content += '• `/kick [utilisateur] [raison]` - Expulse un membre\n';
      content += '• `!ban @user` - Bannit un membre\n';
      content += '• `!mute @user` - Rend muet un membre\n';
      content += '• `!warn @user` - Avertit un membre\n';
    } else if (category === 'util') {
      content += '**🔧 Utilitaires:**\n';
      content += '• `/ping` - Vérifie la latence\n';
      content += '• `/stats` - Statistiques du bot\n';
      content += '• `/userinfo [utilisateur]` - Infos utilisateur\n';
      content += '• `/serverinfo` - Infos serveur\n';
      content += '• `/avatar [utilisateur]` - Affiche l\'avatar\n';
      content += '• `/botinfo` - Informations sur le bot\n';
    } else if (category === 'fun') {
      content += '**🎮 Fun:**\n';
      content += '• `/8ball [question]` - Boule magique\n';
      content += '• `!coinflip` - Lance une pièce\n';
      content += '• `!dice` - Lance un dé\n';
      content += '• `!rps` - Pierre papier ciseaux\n';
      content += '• `!joke` - Blague\n';
      content += '• `!fact` - Fait intéressant\n';
    }
    
    await interaction.reply({
      content,
      ephemeral: true
    });
  }
  
  /**
   * Gère /stats
   */
  async handleStats(interaction, client) {
    const uptime = Math.floor(client.uptime / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    const memoryUsage = process.memoryUsage();
    const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100;
    
    const content = [
      '**📊 Statistiques optimisées**',
      `• Serveurs: ${client.guilds.cache.size}`,
      `• Utilisateurs: ${client.users.cache.size}`,
      `• Ping: ${Math.round(client.ws.ping)}ms`,
      `• Uptime: ${hours}h ${minutes}m`,
      `• Mémoire: ${memoryMB} MB`,
      `• Version: ${require('../../package.json').version}`,
      '',
      '**Performances:**',
      '• Réponses locales: < 100ms',
      '• Cache activé: Oui',
      '• Handler optimisé: Actif'
    ].join('\n');
    
    await interaction.reply({
      content,
      ephemeral: true
    });
  }
  
  /**
   * Gère /userinfo
   */
  async handleUserInfo(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const member = interaction.guild?.members.cache.get(user.id);
    
    const fields = [
      `**Tag:** ${user.tag}`,
      `**ID:** ${user.id}`,
      `**Compte créé:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>`
    ];
    
    if (member) {
      fields.push(`**Rejoint:** <t:${Math.floor(member.joinedTimestamp / 1000)}:R>`);
      fields.push(`**Rôles:** ${member.roles.cache.size - 1}`);
    }
    
    await interaction.reply({
      content: `**👤 Informations sur ${user.username}**\n${fields.join('\n')}`,
      ephemeral: true
    });
  }
  
  /**
   * Gère /serverinfo
   */
  async handleServerInfo(interaction) {
    const guild = interaction.guild;
    
    const fields = [
      `**Nom:** ${guild.name}`,
      `**ID:** ${guild.id}`,
      `**Propriétaire:** <@${guild.ownerId}>`,
      `**Créé:** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
      `**Membres:** ${guild.memberCount}`,
      `**Salons:** ${guild.channels.cache.size}`,
      `**Rôles:** ${guild.roles.cache.size}`
    ];
    
    await interaction.reply({
      content: `**🏰 ${guild.name}**\n${fields.join('\n')}`,
      ephemeral: false
    });
  }
  
  /**
   * Gère /avatar
   */
  async handleAvatar(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const avatarURL = user.displayAvatarURL({ dynamic: true, size: 4096 });
    
    await interaction.reply({
      content: `**🖼️ Avatar de ${user.username}**\n${avatarURL}`,
      ephemeral: true
    });
  }
  
  /**
   * Gère /botinfo
   */
  async handleBotInfo(interaction, client) {
    const fields = [
      `**Nom:** ${client.user.tag}`,
      `**ID:** ${client.user.id}`,
      `**Créé:** <t:${Math.floor(client.user.createdTimestamp / 1000)}:R>`,
      `**Préfixe:** ! (commandes textuelles)`,
      `**Serveurs:** ${client.guilds.cache.size}`,
      `**Version:** ${require('../../package.json').version}`,
      `**Développeur:** Urbanyl 1920`,
      '',
      '**Optimisations:**',
      '• Réponses locales rapides',
      '• Cache intelligent',
      '• Pas de latence inutile',
      '• Commandes de modération'
    ];
    
    await interaction.reply({
      content: `**🤖 ${client.user.username}**\n${fields.join('\n')}`,
      ephemeral: false
    });
  }
  
  /**
   * Gère /clear
   */
  async handleClear(interaction) {
    const amount = interaction.options.getInteger('amount');
    
    if (amount < 1 || amount > 100) {
      return interaction.reply({
        content: '❌ Nombre invalide (1-100)',
        ephemeral: true
      });
    }
    
    await interaction.deferReply({ ephemeral: true });
    
    try {
      const deleted = await interaction.channel.bulkDelete(amount, true);
      await interaction.editReply({
        content: `✅ ${deleted.size} messages supprimés`
      });
    } catch (error) {
      console.error('Erreur clear:', error);
      await interaction.editReply({
        content: '❌ Erreur lors de la suppression'
      });
    }
  }
  
  /**
   * Gère /kick
   */
  async handleKick(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'Aucune raison fournie';
    
    await interaction.deferReply({ ephemeral: true });
    
    try {
      const member = await interaction.guild.members.fetch(user.id);
      
      if (!member.kickable) {
        return interaction.editReply({
          content: '❌ Je ne peux pas expulser ce membre'
        });
      }
      
      await member.kick(reason);
      await interaction.editReply({
        content: `✅ ${user.tag} a été expulsé\n**Raison:** ${reason}`
      });
    } catch (error) {
      console.error('Erreur kick:', error);
      await interaction.editReply({
        content: '❌ Erreur lors de l\'expulsion'
      });
    }
  }
  
  /**
   * Gère /8ball
   */
  async handleEightBall(interaction) {
    const question = interaction.options.getString('question');
    const responses = [
      'Oui, certainement.',
      'C\'est décidément le cas.',
      'Sans aucun doute.',
      'Absolument.',
      'Tu peux compter dessus.',
      'Comme je le vois, oui.',
      'Très probablement.',
      'Les perspectives sont bonnes.',
      'Oui.',
      'Les signes indiquent que oui.',
      'Réponse vague, essaie encore.',
      'Demande plus tard.',
      'Mieux vaut ne pas te le dire maintenant.',
      'Je ne peux pas prédire maintenant.',
      'Concentre-toi et demande à nouveau.',
      'Ne compte pas dessus.',
      'Ma réponse est non.',
      'Mes sources disent non.',
      'Les perspectives ne sont pas bonnes.',
      'Très douteux.'
    ];
    
    const response = responses[Math.floor(Math.random() * responses.length)];
    
    await interaction.reply({
      content: `**🎱 Question:** ${question}\n**Réponse:** ${response}`,
      ephemeral: false
    });
  }
}

module.exports = OptimizedSlashCommands;