/**
 * Gestionnaire de commandes de modération
 * Commandes rapides et efficaces pour la modération
 */

const { PermissionFlagsBits } = require('discord.js');

class ModerationManager {
  constructor(client) {
    this.client = client;
    this.warns = new Map(); // userID -> array de warns
    this.mutes = new Map(); // userID -> { until: timestamp, reason: string }
    this.logChannel = null;
  }

  /**
   * Définit le salon de logs
   */
  setLogChannel(channel) {
    this.logChannel = channel;
  }

  /**
   * Vérifie les permissions de modération
   */
  checkModPermissions(member) {
    return member.permissions.has(PermissionFlagsBits.KickMembers) || 
           member.permissions.has(PermissionFlagsBits.BanMembers) ||
           member.permissions.has(PermissionFlagsBits.ManageMessages) ||
           member.permissions.has(PermissionFlagsBits.ManageRoles);
  }

  /**
   * Enregistre une action de modération
   */
  async logAction(action, moderator, target, reason = 'Aucune raison fournie') {
    if (!this.logChannel) return;
    
    const embed = {
      color: 0xff0000,
      title: `🔨 Action de modération: ${action}`,
      fields: [
        { name: 'Modérateur', value: `${moderator.tag} (${moderator.id})`, inline: true },
        { name: 'Cible', value: `${target.tag} (${target.id})`, inline: true },
        { name: 'Raison', value: reason, inline: false },
        { name: 'Date', value: new Date().toISOString(), inline: true }
      ],
      timestamp: new Date()
    };
    
    try {
      await this.logChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de l\'action:', error);
    }
  }

  /**
   * Commande: !kick
   */
  async kick(message, args) {
    if (!this.checkModPermissions(message.member)) {
      return message.reply('❌ Tu n\'as pas les permissions nécessaires.');
    }

    const target = message.mentions.members.first();
    if (!target) {
      return message.reply('❌ Mentionne un membre à expulser.');
    }

    if (!target.kickable) {
      return message.reply('❌ Je ne peux pas expulser ce membre.');
    }

    const reason = args.slice(1).join(' ') || 'Aucune raison fournie';

    try {
      await target.kick(reason);
      await this.logAction('Kick', message.author, target.user, reason);
      return message.reply(`✅ ${target.user.tag} a été expulsé.`);
    } catch (error) {
      console.error('Erreur lors du kick:', error);
      return message.reply('❌ Erreur lors de l\'expulsion.');
    }
  }

  /**
   * Commande: !ban
   */
  async ban(message, args) {
    if (!this.checkModPermissions(message.member)) {
      return message.reply('❌ Tu n\'as pas les permissions nécessaires.');
    }

    const target = message.mentions.members.first();
    if (!target) {
      return message.reply('❌ Mentionne un membre à bannir.');
    }

    if (!target.bannable) {
      return message.reply('❌ Je ne peux pas bannir ce membre.');
    }

    const reason = args.slice(1).join(' ') || 'Aucune raison fournie';
    const days = parseInt(args.find(arg => !isNaN(parseInt(arg)))) || 0;

    try {
      await target.ban({ reason, days });
      await this.logAction('Ban', message.author, target.user, reason);
      return message.reply(`✅ ${target.user.tag} a été banni${days > 0 ? ` (messages supprimés: ${days} jours)` : ''}.`);
    } catch (error) {
      console.error('Erreur lors du ban:', error);
      return message.reply('❌ Erreur lors du bannissement.');
    }
  }

  /**
   * Commande: !mute
   */
  async mute(message, args) {
    if (!this.checkModPermissions(message.member)) {
      return message.reply('❌ Tu n\'as pas les permissions nécessaires.');
    }

    const target = message.mentions.members.first();
    if (!target) {
      return message.reply('❌ Mentionne un membre à rendre muet.');
    }

    // Trouver le rôle "Muted" ou le créer
    let muteRole = message.guild.roles.cache.find(role => role.name === 'Muted');
    if (!muteRole) {
      try {
        muteRole = await message.guild.roles.create({
          name: 'Muted',
          color: '#000000',
          permissions: [],
          reason: 'Rôle pour les membres muets'
        });
        
        // Configurer les permissions du rôle
        message.guild.channels.cache.forEach(async channel => {
          await channel.permissionOverwrites.edit(muteRole, {
            SendMessages: false,
            AddReactions: false,
            Speak: false
          });
        });
      } catch (error) {
        console.error('Erreur création rôle Muted:', error);
        return message.reply('❌ Erreur lors de la création du rôle Muted.');
      }
    }

    // Analyser la durée
    const timeString = args[1] || '1h';
    const duration = this.parseDuration(timeString);
    
    if (!duration) {
      return message.reply('❌ Durée invalide. Format: 1h, 30m, 2d');
    }

    const reason = args.slice(2).join(' ') || 'Aucune raison fournie';

    try {
      await target.roles.add(muteRole);
      
      // Programmer la fin du mute
      const unmuteTime = Date.now() + duration;
      this.mutes.set(target.id, { until: unmuteTime, reason });
      
      setTimeout(async () => {
        if (target.roles.cache.has(muteRole.id)) {
          await target.roles.remove(muteRole);
          this.mutes.delete(target.id);
        }
      }, duration);

      await this.logAction('Mute', message.author, target.user, `${reason} (${timeString})`);
      return message.reply(`✅ ${target.user.tag} a été rendu muet pour ${timeString}.`);
    } catch (error) {
      console.error('Erreur lors du mute:', error);
      return message.reply('❌ Erreur lors du mute.');
    }
  }

  /**
   * Commande: !warn
   */
  async warn(message, args) {
    if (!this.checkModPermissions(message.member)) {
      return message.reply('❌ Tu n\'as pas les permissions nécessaires.');
    }

    const target = message.mentions.members.first();
    if (!target) {
      return message.reply('❌ Mentionne un membre à avertir.');
    }

    const reason = args.slice(1).join(' ') || 'Aucune raison fournie';
    
    // Récupérer ou initialiser les warns
    let userWarns = this.warns.get(target.id) || [];
    userWarns.push({
      moderator: message.author.tag,
      reason,
      timestamp: Date.now()
    });
    
    this.warns.set(target.id, userWarns);
    
    // Vérifier si l'utilisateur a trop de warns
    const warnCount = userWarns.length;
    let action = '';
    
    if (warnCount >= 3) {
      try {
        await target.send(`⚠️ **Avertissement final**\nVous avez reçu 3 avertissements. La prochaine infraction entraînera un kick.`);
        action = ' (3 warns - avertissement final)';
      } catch {}
    }

    await this.logAction('Warn', message.author, target.user, reason);
    return message.reply(`⚠️ ${target.user.tag} a été averti (${warnCount}/3 warns${action}).`);
  }

  /**
   * Commande: !clear
   */
  async clear(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return message.reply('❌ Tu n\'as pas la permission de gérer les messages.');
    }

    const amount = parseInt(args[0]) || 10;
    
    if (amount < 1 || amount > 100) {
      return message.reply('❌ Nombre invalide (1-100).');
    }

    try {
      const deleted = await message.channel.bulkDelete(amount + 1, true);
      const response = await message.channel.send(`✅ ${deleted.size - 1} messages supprimés.`);
      
      setTimeout(() => response.delete(), 3000);
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      return message.reply('❌ Erreur lors de la suppression des messages.');
    }
  }

  /**
   * Commande: !slowmode
   */
  async slowmode(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return message.reply('❌ Tu n\'as pas la permission de gérer les salons.');
    }

    const seconds = parseInt(args[0]) || 0;
    
    if (seconds < 0 || seconds > 21600) {
      return message.reply('❌ Durée invalide (0-21600 secondes).');
    }

    try {
      await message.channel.setRateLimitPerUser(seconds);
      return message.reply(seconds === 0 ? 
        '✅ Slowmode désactivé.' : 
        `✅ Slowmode défini à ${seconds} seconde(s).`);
    } catch (error) {
      console.error('Erreur lors du slowmode:', error);
      return message.reply('❌ Erreur lors de la configuration du slowmode.');
    }
  }

  /**
   * Commande: !lock / !unlock
   */
  async lockUnlock(message, args, lock = true) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return message.reply('❌ Tu n\'as pas la permission de gérer les salons.');
    }

    try {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: !lock
      });
      
      return message.reply(lock ? 
        '✅ Salon verrouillé.' : 
        '✅ Salon déverrouillé.');
    } catch (error) {
      console.error('Erreur lock/unlock:', error);
      return message.reply(`❌ Erreur lors du ${lock ? 'verrouillage' : 'déverrouillage'}.`);
    }
  }

  /**
   * Parse une durée (ex: "1h", "30m", "2d")
   */
  parseDuration(duration) {
    const match = duration.match(/^(\d+)([hmd])$/);
    if (!match) return null;
    
    const amount = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'm': return amount * 60000; // minutes
      case 'h': return amount * 3600000; // heures
      case 'd': return amount * 86400000; // jours
      default: return null;
    }
  }

  /**
   * Affiche les warns d'un utilisateur
   */
  async showWarns(message, args) {
    if (!this.checkModPermissions(message.member)) {
      return message.reply('❌ Tu n\'as pas les permissions nécessaires.');
    }

    const target = message.mentions.members.first();
    if (!target) {
      return message.reply('❌ Mentionne un membre.');
    }

    const userWarns = this.warns.get(target.id) || [];
    
    if (userWarns.length === 0) {
      return message.reply(`ℹ️ ${target.user.tag} n'a aucun avertissement.`);
    }

    const warnList = userWarns.map((warn, index) => 
      `**${index + 1}.** ${new Date(warn.timestamp).toLocaleDateString()} - ${warn.moderator}\n   Raison: ${warn.reason}`
    ).join('\n\n');

    const embed = {
      color: 0xff9900,
      title: `⚠️ Avertissements de ${target.user.tag}`,
      description: warnList,
      footer: { text: `Total: ${userWarns.length} avertissement(s)` }
    };

    return message.reply({ embeds: [embed] });
  }

  /**
   * Supprime un warn
   */
  async removeWarn(message, args) {
    if (!this.checkModPermissions(message.member)) {
      return message.reply('❌ Tu n\'as pas les permissions nécessaires.');
    }

    const target = message.mentions.members.first();
    if (!target) {
      return message.reply('❌ Mentionne un membre.');
    }

    const warnIndex = parseInt(args[1]) - 1;
    if (isNaN(warnIndex) || warnIndex < 0) {
      return message.reply('❌ Numéro d\'avertissement invalide.');
    }

    const userWarns = this.warns.get(target.id) || [];
    
    if (warnIndex >= userWarns.length) {
      return message.reply('❌ Avertissement non trouvé.');
    }

    userWarns.splice(warnIndex, 1);
    this.warns.set(target.id, userWarns);
    
    await this.logAction('Remove Warn', message.author, target.user, `Suppression du warn #${warnIndex + 1}`);
    return message.reply(`✅ Avertissement supprimé. ${target.user.tag} a maintenant ${userWarns.length} avertissement(s).`);
  }
}

module.exports = ModerationManager;