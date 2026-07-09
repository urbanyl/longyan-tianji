# Getting Started

This guide gets you up and running in 5 minutes.

## Prerequisites

- Node.js 18+
- A Discord bot token
- An OpenRouter API key (free)

## Step 1: Get Your Keys

### Discord Token
1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Go to "Bot" section
4. Click "Add Bot"
5. Under TOKEN, click "Copy"
6. Save this somewhere safe

### OpenRouter API Key
1. Go to https://openrouter.ai
2. Sign up or log in
3. Go to Settings > API Keys
4. Generate a new key
5. Copy it - format is `sk-or-v1-...`

## Step 2: Clone and Install

```bash
git clone https://github.com/urbanyl/longyan-tianji.git
cd longyan-tianji
npm install
npx playwright install chromium
```

## Step 3: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with a text editor and add your keys:

```
DISCORD_TOKEN=paste_your_bot_token_here
DISCORD_CLIENT_ID=paste_your_client_id_here
OPENROUTER_API_KEY=sk-or-v1-paste_your_key_here
ADMIN_USER_IDS=your_discord_user_id
ALLOW_PUBLIC_COMMANDS=true
SECURITY_REQUIRE_ALLOWLIST=false
```

To get your Discord user ID:
1. Enable Developer Mode in Discord settings
2. Right-click your name and select "Copy User ID"

## Step 4: Start the Bot

```bash
npm start
```

You should see:
```
Longyan Tianji is online as YourBotName#0000
Slash commands deployed successfully
```

## Step 5: Add Bot to Your Server

1. Go back to Discord Developer Portal
2. Click OAuth2 > URL Generator
3. Select these scopes:
   - bot
   - applications.commands
4. Select these permissions:
   - Send Messages
   - Read Messages/View Channels
   - Embed Links
5. Copy the generated URL
6. Open it in your browser and add the bot to your server

## Step 6: Test It

In Discord, try these commands:

```
/chat Hello
/profile
/help
```

## Commands

All available commands:

| Command | What it does |
|---------|------------|
| /chat message | Talk to the AI |
| /profile | See your profile |
| /memory | See memory stats |
| /lang en | Switch to English |
| /lang zh | Switch to Chinese |
| /help | List all commands |
| /ping | Check latency |
| /info | About the bot |
| /stats | Bot statistics |
| /feedback message | Send feedback |
| /clear-memory | Delete all your data |

## How It Works

### Chat with AI

Type `/chat Hello` and the bot responds using OpenRouter's Tencent Hy3 model.

The bot learns your communication style automatically. Check `/profile` to see what it learned.

### Language Support

- `/lang en` - Responses in English
- `/lang zh` - Responses in Chinese

Unauthorized users see a message in Chinese.

### Memory

The bot stores data locally in `data/user-memory/{userId}.json`

This includes:
- Your last 50 messages
- Topics you're interested in
- Your communication style
- When you started chatting

Data is stored locally only. Not sent anywhere.

## Configuration

### Development Mode
```
ALLOW_PUBLIC_COMMANDS=true
SECURITY_REQUIRE_ALLOWLIST=false
```

Anyone can use the bot.

### Production Mode
```
ALLOW_PUBLIC_COMMANDS=false
SECURITY_REQUIRE_ALLOWLIST=true
ALLOWED_USER_IDS=123456,789012
ADMIN_USER_IDS=123456
```

Only whitelisted users can use commands.

## Troubleshooting

### Bot isn't responding
- Check DISCORD_TOKEN is correct
- Verify bot has "Send Messages" permission in the channel
- Make sure bot is actually in the server

### Chat not working
- Check OPENROUTER_API_KEY is set
- Verify the key is valid at openrouter.ai
- Check you have free credits

### Slash commands don't show up
- Restart the bot
- Commands deploy automatically on startup
- Make sure bot has "applications.commands" scope
- Check bot is in your server

### Memory not saving
- Make sure `data/user-memory/` directory exists (auto-created)
- Check file system write permissions
- Check USER_MEMORY_PATH in .env

## More Information

- Full changelog: see CHANGELOG.md
- Technical details: see IMPLEMENTATION_SUMMARY.md
- Verification script: `node VERIFICATION_CHECKLIST.js`
