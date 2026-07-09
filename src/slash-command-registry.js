const { SlashCommandBuilder } = require("discord.js");
const SlashCommandManager = require("./slash-command-manager");

class SlashCommandRegistry {
  constructor() {
	this.manager = new SlashCommandManager();
  }

  /**
   * Enregistre tous les slash commands disponibles
   */
  registerAll() {
	// Commande /chat
	this.manager.register("chat", {
	  description: "Chat with the AI assistant",
	  options: [
		{
		  name: "message",
		  type: "STRING",
		  description: "Your message to the AI",
		  required: true
		},
		{
		  name: "language",
		  type: "STRING",
		  description: "Response language (en/zh)",
		  required: false
		}
	  ],
	  dmPermission: true,
	  execute: null // Will be handled by InteractionHandler
	});

	// Commande /ping
	this.manager.register("ping", {
	  description: "Check bot latency",
	  dmPermission: true,
	  execute: null
	});

	// Commande /help
	this.manager.register("help", {
	  description: "Show available commands",
	  dmPermission: true,
	  execute: null
	});

	// Commande /memory
	this.manager.register("memory", {
	  description: "View your memory statistics",
	  dmPermission: true,
	  execute: null
	});

	// Commande /profile
	this.manager.register("profile", {
	  description: "View your user profile",
	  dmPermission: true,
	  execute: null
	});

	// Commande /stats
	this.manager.register("stats", {
	  description: "View bot statistics",
	  dmPermission: false,
	  execute: null
	});

	// Commande /info
	this.manager.register("info", {
	  description: "Get information about the bot",
	  dmPermission: true,
	  execute: null
	});

	// Commande /clear-memory (admin only)
	this.manager.register("clear-memory", {
	  description: "Clear your memory data",
	  defaultMemberPermissions: 0, // Non-admin peut aussi l'utiliser
	  dmPermission: true,
	  execute: null
	});

	// Commande /lang (définir la langue)
	this.manager.register("lang", {
	  description: "Set your preferred language",
	  options: [
		{
		  name: "language",
		  type: "STRING",
		  description: "en (English) or zh (Chinese)",
		  required: true
		}
	  ],
	  dmPermission: true,
	  execute: null
	});

	// Commande /feedback
	this.manager.register("feedback", {
	  description: "Send feedback about the bot",
	  options: [
		{
		  name: "message",
		  type: "STRING",
		  description: "Your feedback",
		  required: true
		}
	  ],
	  dmPermission: true,
	  execute: null
	});
  }

  /**
   * Obtient tous les slash commands enregistrés
   * @returns {SlashCommandManager}
   */
  getManager() {
	return this.manager;
  }

  /**
   * Déploie les slash commands sur Discord
   * @param {Client} client 
   * @param {string} guildId - Guild ID optionnel pour tester localement
   */
  async deploy(client, guildId = null) {
	try {
	  console.log("Deploying slash commands...");

	  const commands = this.manager.toJSON();

	  if (guildId) {
		// Déployer uniquement pour une guild (développement)
		const guild = await client.guilds.fetch(guildId);
		if (guild) {
		  await guild.commands.set(commands);
		  console.log(`✓ Deployed ${commands.length} commands to guild ${guildId}`);
		}
	  } else {
		// Déployer globalement (production)
		await client.application.commands.set(commands);
		console.log(`✓ Deployed ${commands.length} slash commands globally`);
	  }

	  return true;
	} catch (error) {
	  console.error("Error deploying slash commands:", error);
	  return false;
	}
  }
}

module.exports = SlashCommandRegistry;
