const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");

class SlashCommandManager {
  constructor() {
	this.commands = new Map();
  }

  /**
   * Enregistre une slash command
   * @param {string} name - Nom de la commande
   * @param {Object} config - Configuration { description, adminOnly, options, execute }
   */
  register(name, config) {
	this.commands.set(name, config);
  }

  /**
   * Obtient une slash command
   * @param {string} name 
   * @returns {Object|null}
   */
  get(name) {
	return this.commands.get(name) || null;
  }

  /**
   * Construit les slash commands pour Discord API
   * @returns {Array} Array de SlashCommandBuilders
   */
  build() {
	const builders = [];

	this.commands.forEach((config, name) => {
	  const builder = new SlashCommandBuilder()
		.setName(name)
		.setDescription(config.description || "No description");

	  // Ajouter les options si fournies
	  if (config.options && Array.isArray(config.options)) {
		config.options.forEach(option => {
		  if (option.type === "STRING") {
			builder.addStringOption(opt =>
			  opt
				.setName(option.name)
				.setDescription(option.description || "")
				.setRequired(option.required ?? false)
			);
		  } else if (option.type === "INTEGER") {
			builder.addIntegerOption(opt =>
			  opt
				.setName(option.name)
				.setDescription(option.description || "")
				.setRequired(option.required ?? false)
			);
		  } else if (option.type === "BOOLEAN") {
			builder.addBooleanOption(opt =>
			  opt
				.setName(option.name)
				.setDescription(option.description || "")
				.setRequired(option.required ?? false)
			);
		  }
		});
	  }

	  // Ajouter des permissions si nécessaire
	  if (config.defaultMemberPermissions) {
		builder.setDefaultMemberPermissions(config.defaultMemberPermissions);
	  }
	  if (config.dmPermission !== undefined) {
		builder.setDMPermission(config.dmPermission);
	  }

	  builders.push(builder);
	});

	return builders;
  }

  /**
   * Obtient un array de JSON pour enregistrer sur Discord
   * @returns {Array}
   */
  toJSON() {
	return this.build().map(b => b.toJSON());
  }
}

module.exports = SlashCommandManager;
