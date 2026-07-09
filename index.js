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

async function main() {
  const memory = new MemoryManager(config.execution.memoryPath);
  const browser = new BrowserAgent(config.browser, config.brand);
  const codeRunner = new CodeRunner(config.docker, config.execution);
  const fileGenerator = new FileGenerator(config.output, config.brand);
  const research = new ResearchAgent(config.research);
  const planner = new CommandPlanner();

  const orchestrator = new Orchestrator({
    config,
    memory,
    browser,
    codeRunner,
    fileGenerator,
    research,
    planner
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

  const token = config.discord.userTokenMode ? config.discord.userToken : config.discord.token;
  
  if (!token) {
    const tokenName = config.discord.userTokenMode ? 'DISCORD_USER_TOKEN' : 'DISCORD_TOKEN';
    if (dashboard) {
      console.warn(`${tokenName} is missing. Running local dashboard only.`);
      return;
    }
    throw new Error(`${tokenName} is missing.`);
  }

  if (config.discord.userTokenMode) {
    console.warn('DISCORD_USER_TOKEN_MODE is enabled. Using user token (selfbot mode).');
    console.warn('This is against Discord Terms of Service. Use at your own risk.');
  }

  client = new Client({
    intents: config.discord.userTokenMode
      ? [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.DirectMessages,
          GatewayIntentBits.MessageContent
        ]
      : [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent
        ],
    partials: config.discord.userTokenMode
      ? [Partials.Channel, Partials.Message, Partials.User]
      : [Partials.Channel, Partials.Message]
  });

  const handler = new DiscordHandler(client, orchestrator, config);

  client.once(Events.ClientReady, () => {
    console.log(`${config.brand.project} ${config.brand.bot} is online as ${client.user.tag}`);
  });

  client.on('messageCreate', async (message) => {
    await handler.handleMessage(message);
  });

  await client.login(token);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
