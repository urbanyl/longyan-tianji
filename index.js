const { Client, Events, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./src/config');
const MemoryManager = require('./src/memory');
const BrowserAgent = require('./src/browser-agent');
const CodeRunner = require('./src/code-runner');
const FileGenerator = require('./src/file-generator');
const ResearchAgent = require('./src/research-agent');
const CommandPlanner = require('./src/command-planner');
const Orchestrator = require('./src/orchestrator');
const DiscordHandler = require('./src/discord-handler');
const LocalDashboard = require('./src/local-dashboard');
const AuthManager = require('./src/auth-manager');
const OpenRouterHandler = require('./src/openrouter-handler');
const UserMemory = require('./src/user-memory');
const EmbedBuilder = require('./src/embed-builder');
const SlashCommandRegistry = require('./src/slash-command-registry');
const CommandInterceptor = require('./src/command-interceptor');

async function main() {
  const memory = new MemoryManager(config.execution.memoryPath);
  const browser = new BrowserAgent(config.browser, config.brand);
  const codeRunner = new CodeRunner(config.docker, config.execution);
  const fileGenerator = new FileGenerator(config.output, config.brand);
  const research = new ResearchAgent(config.research);
  const planner = new CommandPlanner();

  // Initialiser les nouveaux composants
  let openrouter = null;
  if (config.openrouter?.apiKey) {
    try {
      openrouter = new OpenRouterHandler(config.openrouter.apiKey);
    } catch (error) {
      console.warn('OpenRouter initialization failed:', error.message);
    }
  }

  const userMemory = new UserMemory('./data/user-memory');
  const embedBuilder = new EmbedBuilder();
  const authManager = new AuthManager(config.security || {});

  const orchestrator = new Orchestrator({
    config,
    memory,
    browser,
    codeRunner,
    fileGenerator,
    research,
    planner,
    openrouter,
    userMemory,
    embedBuilder,
    authManager
  });

  let dashboard = null;
  let client = null;

  if (config.localDashboard.enabled) {
    dashboard = new LocalDashboard({ config, orchestrator });
    await dashboard.start();
  }

  const shutdown = async (signal) => {
    console.log(`${config.brand.bot} received ${signal}.`);
    if (dashboard) await dashboard.close().catch(() => {});
    await orchestrator.shutdown();
    if (client) await client.destroy();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (error) => {
    console.error(`${config.brand.bot} unhandled rejection:`, error);
  });

  const token = config.discord.token;

  if (!token) {
    if (dashboard) {
      console.warn('DISCORD_TOKEN is missing. Running local dashboard only.');
      return;
    }
    throw new Error('DISCORD_TOKEN is missing.');
  }

  console.log('Initializing bot in APPLICATION MODE (not selfbot)...');

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User]
  });

  const handler = new DiscordHandler(client, orchestrator, config, {
    userMemory,
    embedBuilder,
    authManager,
    openrouter
  });

  const commandInterceptor = new CommandInterceptor();

  // Charger le handler optimisé - DISABLED
  // const OptimizedHandler = require('./src/optimized-handler');
  // const optimizedHandler = new OptimizedHandler(client, handler);

  client.once(Events.ClientReady, async () => {
    console.log(`${config.brand.project} ${config.brand.bot} is online as ${client.user.tag}`);
    console.log(`Slash commands are available! Add the bot to your server.`);
    console.log(`🔧 Handler optimisé activé avec commandes rapides`);

    // Set presence optimisé
    try {
      await client.user.setPresence({ 
        activities: [{ 
          name: 'Optimisé | !help', 
          type: 3 // Watching
        }], 
        status: 'online' 
      });
    } catch (err) {
      console.warn('Failed to set presence:', err.message);
    }

    // Déployer les slash commands optimisés
    const OptimizedSlashCommands = require('./src/optimized-slash-commands');
    const optimizedSlash = new OptimizedSlashCommands();
    
    try {
      await client.application.commands.set(optimizedSlash.toJSON());
      console.log(`✅ ${optimizedSlash.getCommands().length} slash commands optimisés déployés`);
    } catch (error) {
      console.error('Erreur déploiement slash commands optimisés:', error);
      // Fallback aux slash commands originaux
      const slashRegistry = new SlashCommandRegistry();
      slashRegistry.registerAll();
      await slashRegistry.deploy(client);
    }
  });

  client.on('messageCreate', async (message) => {
    // Intercepter les nouvelles commandes (search, weather, crypto, etc)
    if (await commandInterceptor.intercept(message, config.brand.prefix)) {
      return;
    }

    // Puis utiliser le handler original
    try {
      await handler.handleMessage(message);
    } catch (error) {
      console.error('Handler error:', error);
    }
  });

  // Gérer les interactions (slash commands)
  client.on('interactionCreate', async (interaction) => {
    // Essayer d'abord les slash commands optimisés
    const OptimizedSlashCommands = require('./src/optimized-slash-commands');
    const optimizedSlash = new OptimizedSlashCommands();
    
    try {
      await optimizedSlash.handleInteraction(interaction, client);
    } catch (error) {
      // Fallback au handler original
      await handler.handleInteraction(interaction);
    }
  });

  // Gérer les message updates pour les replies
  client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (newMessage.author.bot) return; // Ignorer les messages du bot

    // Vérifier si c'est une réponse
    if (newMessage.reference) {
      try {
        const repliedTo = await newMessage.channel.messages.fetch(newMessage.reference.messageId);
        if (repliedTo.author.id === client.user.id) {
          // L'utilisateur répond à un message du bot
          await handler.handleReply(newMessage, repliedTo);
        }
      } catch (error) {
        console.error('Error handling reply:', error);
      }
    }
  });

  await client.login(token);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
