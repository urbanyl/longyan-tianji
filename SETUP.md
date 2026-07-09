# Setup and Deployment

This bot is ready to run. Here's what to check before deploying.

## What's New

Version 2.0 adds:
- AI chat with OpenRouter
- User memory system
- Slash commands
- English and Chinese support

## Requirements

- Node.js 18 or higher
- Discord bot token
- OpenRouter API key (free)

## Installation

1. Install dependencies:
```bash
npm install
npx playwright install chromium
```

2. Copy environment template:
```bash
cp .env.example .env
```

3. Edit .env with your keys:
```
DISCORD_TOKEN=your_token
DISCORD_CLIENT_ID=your_client_id
OPENROUTER_API_KEY=sk-or-v1-your_key
ADMIN_USER_IDS=your_user_id
```

4. Start:
```bash
npm start
```

## Verification

Run the verification script:
```bash
node VERIFICATION_CHECKLIST.js
```

This checks:
- All modules can be loaded
- Documentation files exist
- Basic setup is correct

## Environment Setup

Required:
```
DISCORD_TOKEN              - Bot token from Discord Developer Portal
DISCORD_CLIENT_ID          - Application ID from Developer Portal
OPENROUTER_API_KEY         - API key from openrouter.ai
ADMIN_USER_IDS             - Your Discord user ID for admin access
```

Optional:
```
ALLOW_PUBLIC_COMMANDS      - Set to true to allow anyone to use commands
SECURITY_REQUIRE_ALLOWLIST - Set to true to require whitelist in production
ALLOWED_USER_IDS           - Comma-separated list of allowed user IDs
USER_MEMORY_PATH           - Where to store user data (default: ./data/user-memory)
```

## First Run

When you start the bot for the first time:

1. It will deploy all slash commands to Discord
2. It will create the data/user-memory directory
3. After that, user profiles are created as needed

Output should show:
```
Longyan Tianji is online as YourBotName#0000
Slash commands deployed successfully
Deployed 10 slash commands globally
```

## Adding to a Server

1. Go to Discord Developer Portal
2. Click your application
3. Go to OAuth2 > URL Generator
4. Select scopes: `bot` and `applications.commands`
5. Select permissions: `Send Messages`, `Read Messages`, `Embed Links`
6. Copy the URL and open it
7. Select a server and authorize

## Testing Commands

Once the bot is in a server, try:

```
/chat Hello
/profile
/help
/lang zh
```

## Development vs Production

Development (testing):
```
ALLOW_PUBLIC_COMMANDS=true
SECURITY_REQUIRE_ALLOWLIST=false
```

Production (secure):
```
ALLOW_PUBLIC_COMMANDS=false
SECURITY_REQUIRE_ALLOWLIST=true
ALLOWED_USER_IDS=user1_id,user2_id,user3_id
ADMIN_USER_IDS=admin_id
```

## File Structure

```
longyan-tianji/
├── index.js                          Main entry point
├── src/
│   ├── openrouter-handler.js         AI chat integration
│   ├── user-memory.js                User data storage
│   ├── embed-builder.js              Discord message formatting
│   ├── auth-manager.js               Access control
│   ├── interaction-handler.js        Slash command handling
│   ├── chat-manager.js               Chat logic
│   ├── slash-command-manager.js      Command configuration
│   ├── slash-command-registry.js     Command registration
│   └── ... (other existing modules)
├── data/
│   └── user-memory/                  User profile storage (auto-created)
├── .env.example                      Configuration template
├── QUICKSTART.md                     Getting started guide
├── CHANGELOG.md                      Version history
├── IMPLEMENTATION_SUMMARY.md         Technical details
└── VERIFICATION_CHECKLIST.js         Setup verification
```

## Troubleshooting

**Bot won't start:**
- Check Node.js version (18+)
- Check npm install completed
- Check .env file exists and has required values

**Slash commands don't appear:**
- Restart the bot
- Wait a few seconds for Discord to sync
- Verify bot has `applications.commands` scope

**Chat not working:**
- Verify OPENROUTER_API_KEY is set
- Check the key is valid at openrouter.ai
- Ensure you have free credits available

**Permission errors:**
- Check bot has required Discord permissions
- Add bot to the server properly via OAuth2
- Verify ADMIN_USER_IDS if using whitelist

**Memory not saving:**
- Check data/user-memory directory exists
- Verify write permissions on the directory
- Check USER_MEMORY_PATH in .env

## Running as Service

To run the bot continuously (Linux/Mac):

```bash
npm install -g pm2
pm2 start index.js --name "tianji"
pm2 save
pm2 startup
```

To check status:
```bash
pm2 status
```

To stop:
```bash
pm2 stop tianji
```

## Monitoring

Check if bot is online:
```bash
/ping
```

View bot stats:
```bash
/stats
```

## Logs

The bot outputs logs to console. For production, redirect to file:

```bash
npm start > bot.log 2>&1 &
```

## Updates

To update to latest version:

```bash
git pull origin main
npm install
npm start
```

Existing user data is preserved.

## Support

For issues:
- Check QUICKSTART.md
- Check IMPLEMENTATION_SUMMARY.md
- Open an issue on GitHub
