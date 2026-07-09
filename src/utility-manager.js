/**
 * Gestionnaire de commandes utilitaires
 * Commandes rapides et utiles pour les serveurs Discord
 */

class UtilityManager {
  constructor(client) {
    this.client = client;
  }

  /**
   * Commande: !userinfo
   */
  async userinfo(message, args) {
    const target = message.mentions.members.first() || message.member;
    
    const embed = {
      color: 0x0099ff,
      title: `👤 Informations sur ${target.user.tag}`,
      thumbnail: { url: target.user.displayAvatarURL({ dynamic: true, size: 256 }) },
      fields: [
        { name: 'ID', value: target.user.id, inline: true },
        { name: 'Pseudo', value: target.user.username, inline: true },
        { name: 'Tag', value: `#${target.user.discriminator}`, inline: true },
        { name: 'Compte créé le', value: `<t:${Math.floor(target.user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Rejoint le', value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`, inline: true },
        { name: 'Rôles', value: target.roles.cache.size > 1 ? 
          target.roles.cache.filter(r => r.id !== message.guild.id).map(r => r.name).join(', ').slice(0, 1000) || 'Aucun' : 'Aucun', inline: false }
      ],
      footer: { text: `Demandé par ${message.author.tag}` }
    };

    return message.reply({ embeds: [embed] });
  }

  /**
   * Commande: !serverinfo
   */
  async serverinfo(message, args) {
    const guild = message.guild;
    
    const embed = {
      color: 0x00ff00,
      title: `🏰 Informations sur ${guild.name}`,
      thumbnail: { url: guild.iconURL({ dynamic: true, size: 256 }) },
      fields: [
        { name: 'ID', value: guild.id, inline: true },
        { name: 'Propriétaire', value: `<@${guild.ownerId}>`, inline: true },
        { name: 'Créé le', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Membres', value: `${guild.memberCount}`, inline: true },
        { name: 'Salons', value: `${guild.channels.cache.size}`, inline: true },
        { name: 'Rôles', value: `${guild.roles.cache.size}`, inline: true },
        { name: 'Niveau de vérification', value: this.getVerificationLevel(guild.verificationLevel), inline: true },
        { name: 'Boost', value: `Niveau ${guild.premiumTier} (${guild.premiumSubscriptionCount} boosts)`, inline: true }
      ],
      footer: { text: `Demandé par ${message.author.tag}` }
    };

    return message.reply({ embeds: [embed] });
  }

  /**
   * Commande: !avatar
   */
  async avatar(message, args) {
    const target = message.mentions.users.first() || message.author;
    
    const embed = {
      color: 0x0099ff,
      title: `🖼️ Avatar de ${target.tag}`,
      image: { url: target.displayAvatarURL({ dynamic: true, size: 4096 }) },
      description: `[Lien vers l'avatar](${target.displayAvatarURL({ dynamic: true, size: 4096 })})`,
      footer: { text: `Demandé par ${message.author.tag}` }
    };

    return message.reply({ embeds: [embed] });
  }

  /**
   * Commande: !roleinfo
   */
  async roleinfo(message, args) {
    const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
    
    if (!role) {
      return message.reply('❌ Mentionne un rôle ou donne son ID.');
    }
    
    const embed = {
      color: role.color || 0x2f3136,
      title: `🎭 Informations sur le rôle ${role.name}`,
      fields: [
        { name: 'ID', value: role.id, inline: true },
        { name: 'Créé le', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Membres', value: `${role.members.size}`, inline: true },
        { name: 'Couleur', value: role.hexColor, inline: true },
        { name: 'Position', value: `${role.position}`, inline: true },
        { name: 'Mentionnable', value: role.mentionable ? 'Oui' : 'Non', inline: true },
        { name: 'Permissions', value: this.formatPermissions(role.permissions).slice(0, 1000) || 'Aucune', inline: false }
      ],
      footer: { text: `Demandé par ${message.author.tag}` }
    };

    return message.reply({ embeds: [embed] });
  }

  /**
   * Commande: !poll
   */
  async poll(message, args) {
    const question = args.join(' ');
    if (!question) {
      return message.reply('❌ Donne une question pour le sondage.');
    }

    const embed = {
      color: 0x00ff00,
      title: '📊 Sondage',
      description: question,
      footer: { text: `Créé par ${message.author.tag}` },
      timestamp: new Date()
    };

    try {
      const pollMessage = await message.channel.send({ embeds: [embed] });
      await pollMessage.react('✅');
      await pollMessage.react('❌');
      await pollMessage.react('🤷');
      
      await message.delete();
    } catch (error) {
      console.error('Erreur création sondage:', error);
      return message.reply('❌ Erreur lors de la création du sondage.');
    }
  }

  /**
   * Commande: !stats
   */
  async stats(message, args) {
    const uptime = Math.floor(this.client.uptime / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;
    
    const memoryUsage = process.memoryUsage();
    const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100;
    
    const embed = {
      color: 0x0099ff,
      title: '📊 Statistiques du bot',
      fields: [
        { name: 'Serveurs', value: `${this.client.guilds.cache.size}`, inline: true },
        { name: 'Utilisateurs', value: `${this.client.users.cache.size}`, inline: true },
        { name: 'Salons', value: `${this.client.channels.cache.size}`, inline: true },
        { name: 'Ping', value: `${Math.round(this.client.ws.ping)}ms`, inline: true },
        { name: 'Uptime', value: `${hours}h ${minutes}m ${seconds}s`, inline: true },
        { name: 'Mémoire', value: `${memoryMB} MB`, inline: true },
        { name: 'Version Node', value: process.version, inline: true },
        { name: 'Version Discord.js', value: require('discord.js').version, inline: true }
      ],
      footer: { text: `Demandé par ${message.author.tag}` }
    };

    return message.reply({ embeds: [embed] });
  }

  /**
   * Commande: !ping
   */
  async ping(message, args) {
    const sent = await message.reply('🏓 Pinging...');
    const latency = sent.createdTimestamp - message.createdTimestamp;
    const apiLatency = Math.round(this.client.ws.ping);
    
    await sent.edit(`🏓 Pong!\nLatence: ${latency}ms\nAPI: ${apiLatency}ms`);
  }

  /**
   * Commande: !invite
   */
  async invite(message, args) {
    const embed = {
      color: 0x5865f2,
      title: '🔗 Inviter le bot',
      description: `[Clique ici pour inviter ${this.client.user.tag} sur ton serveur](https://discord.com/oauth2/authorize?client_id=${this.client.user.id}&scope=bot&permissions=8)`,
      fields: [
        { name: 'Permissions recommandées', value: 'Administrateur pour toutes les fonctionnalités', inline: false },
        { name: 'Support', value: 'Utilise `!help` pour voir toutes les commandes', inline: false }
      ],
      footer: { text: 'Merci de ton intérêt !' }
    };

    return message.reply({ embeds: [embed] });
  }

  /**
   * Commande: !botinfo
   */
  async botinfo(message, args) {
    const embed = {
      color: 0x0099ff,
      title: `🤖 ${this.client.user.tag}`,
      thumbnail: { url: this.client.user.displayAvatarURL({ dynamic: true, size: 256 }) },
      fields: [
        { name: 'ID', value: this.client.user.id, inline: true },
        { name: 'Créé le', value: `<t:${Math.floor(this.client.user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Préfixe', value: '!', inline: true },
        { name: 'Commandes', value: 'Modération, utilitaires, fun', inline: true },
        { name: 'Serveurs', value: `${this.client.guilds.cache.size}`, inline: true },
        { name: 'Développeur', value: 'Urbanyl 1920', inline: true },
        { name: 'Code source', value: '[GitHub](https://github.com/urbanyl/longyan-tianji)', inline: true }
      ],
      description: 'Un bot Discord optimisé avec des commandes de modération et utilitaires rapides.',
      footer: { text: `Version ${require('../package.json').version}` }
    };

    return message.reply({ embeds: [embed] });
  }

  /**
   * Formate les permissions
   */
  formatPermissions(permissions) {
    const perms = [];
    for (const [perm, has] of Object.entries(permissions.serialize())) {
      if (has) {
        const prettyPerm = perm
          .replace(/_/g, ' ')
          .replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
        perms.push(prettyPerm);
      }
    }
    return perms.join(', ');
  }

  /**
   * Convertit le niveau de vérification
   */
  getVerificationLevel(level) {
    const levels = {
      0: 'Aucune',
      1: 'Faible',
      2: 'Moyen', 
      3: 'Élevé',
      4: 'Très élevé'
    };
    return levels[level] || 'Inconnu';
  }
}

module.exports = UtilityManager;