const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./src/config');
const MemoryManager = require('./src/memory');
const BrowserAgent = require('./src/browser-agent');
const CodeRunner = require('./src/code-runner');
const FileGenerator = require('./src/file-generator');
const ResearchAgent = require('./src/research-agent');
const CommandPlanner = require('./src/command-planner');
const Orchestrator = require('./src/orchestrator');
const DiscordHandler = require('./src/discord-handler');

async function main() {
  if (!config.discord.token) {
    throw new Error('DISCORD_TOKEN is missing.');
  }

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

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.Message]
  });

  const handler = new DiscordHandler(client, orchestrator, config);

  client.once('ready', () => {
    console.log(`${config.brand.project} ${config.brand.bot} is online as ${client.user.tag}`);
  });

  client.on('messageCreate', async (message) => {
    await handler.handleMessage(message);
  });

  const shutdown = async (signal) => {
    console.log(`${config.brand.bot} received ${signal}.`);
    await orchestrator.shutdown();
    await client.destroy();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (error) => {
    console.error(`${config.brand.bot} unhandled rejection:`, error);
  });

  await client.login(config.discord.token);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
