# CHANGELOG v2.0

## What's New

This version adds AI chat capabilities and persistent user memory to the bot.

## New Modules

### openrouter-handler.js
Handles communication with OpenRouter API. Supports streaming responses for real-time chat.

Usage:
```javascript
const openrouter = new OpenRouterHandler(apiKey);
const response = await openrouter.chat(message, conversationHistory);
```

### user-memory.js
Stores user data locally in JSON files. Each user gets their own file at `data/user-memory/{userId}.json`.

Tracks:
- Conversation history (last 50 messages)
- User characteristics (talking style, personality, topics)
- Interaction logs and stats
- Personal notes

### embed-builder.js
Creates Discord embeds with English and Chinese translations built in.

Methods:
- createChatEmbed()
- createErrorEmbed()
- createSuccessEmbed()
- createUnauthorizedEmbed()

### auth-manager.js
Manages access control. Supports:
- User whitelists
- Admin lists
- Role-based access
- Server/channel restrictions

### interaction-handler.js
Handles slash commands. Processes:
- /chat - AI chat
- /profile - User profile
- /memory - Memory stats
- /lang - Language selection
- And 6 more commands

### chat-manager.js
Main chat logic. Builds context, analyzes user messages, and maintains conversation state.

### slash-command-manager.js
Converts command definitions into Discord JSON format.

### slash-command-registry.js
Registers all slash commands and deploys them to Discord on startup.

## Modified Files

### index.js
- Removed selfbot mode support
- Added slash command deployment
- Integrated new modules

### src/discord-handler.js
- Added handleInteraction() method
- Added handleReply() method
- Passes modules to InteractionHandler

### .env.example
- Added OPENROUTER_API_KEY
- Added USER_MEMORY_PATH
- Removed selfbot variables

## Configuration

Required environment variables:
```
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
OPENROUTER_API_KEY=sk-or-v1-your_key
ADMIN_USER_IDS=your_discord_id
```

Optional:
```
USER_MEMORY_PATH=./data/user-memory
USER_MEMORY_MAX_CONVERSATION_LENGTH=50
SECURITY_REQUIRE_ALLOWLIST=false
ALLOW_PUBLIC_COMMANDS=true
```

## Commands

1. `/chat <message>` - Chat with AI
2. `/ping` - Bot latency
3. `/help` - Show commands
4. `/profile` - Your profile
5. `/memory` - Memory stats
6. `/clear-memory` - Clear your data
7. `/lang <en|zh>` - Set language
8. `/info` - About the bot
9. `/stats` - Server stats
10. `/feedback <message>` - Send feedback

## Memory System

Each user file contains:

```json
{
  "userId": "123456789",
  "profile": {
	"language": "en"
  },
  "conversationHistory": [
	{ "role": "user", "content": "..." },
	{ "role": "assistant", "content": "..." }
  ],
  "characteristics": {
	"talkingStyle": "casual",
	"personality": "friendly",
	"topics": ["programming", "gaming"],
	"likes": ["python"],
	"dislikes": []
  },
  "interactions": {
	"totalMessages": 42,
	"totalInteractions": 15,
	"firstInteraction": "2024-01-15T10:30:00Z",
	"lastInteraction": "2024-01-20T15:45:00Z"
  }
}
```

## Breaking Changes

Selfbot mode is no longer supported. The `DISCORD_USER_TOKEN_MODE` variable has no effect.

Use a regular Discord bot token instead.

## Migration from v1

If you're upgrading from v1:

1. Your existing commands still work the same way
2. New slash commands are available alongside text commands
3. Add `OPENROUTER_API_KEY` to .env to enable chat
4. User memory starts fresh (separate from old task memory)
5. No changes needed to automation tasks

## Testing

All modules have been syntax checked. Run the verification script:

```bash
node VERIFICATION_CHECKLIST.js
```

## Known Issues

None at this time.

## Future Plans

Possible improvements for future versions:
- Database backend for scalability
- User management admin commands
- Message logging improvements
- Performance optimizations
