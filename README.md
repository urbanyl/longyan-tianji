# Longyan

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.js.org/)
[![Playwright](https://img.shields.io/badge/Playwright-browser%20control-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)
[![Docker](https://img.shields.io/badge/Docker-sandbox-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![SQLite](https://img.shields.io/badge/SQLite-memory-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![License](https://img.shields.io/badge/license-MIT-f7c948?style=for-the-badge)](LICENSE)
[![Made by Urbanyl](https://img.shields.io/badge/made%20by-Urbanyl%201920-0c111d?style=for-the-badge)](https://github.com/urbanyl)

Longyan is the command engine. Tianji is the Discord operator inside it.

It opens pages, reads them, clicks through flows, runs short Python or JavaScript jobs inside Docker, writes files, keeps memory, and turns rough Discord messages into clean execution plans.

Project name: Long Yan  
Bot name: Tian Ji  
Signature: Urbanyl 1920

## Core

| Layer | Runtime |
| --- | --- |
| Discord | Discord.js v14 |
| Browser | Playwright Chromium |
| Code | Docker, isolated by default |
| Files | PDFKit, XLSX, Sharp |
| Memory | SQLite with task history |
| Planner | Local command router |

## Install

```bash
npm install
npx playwright install
cp .env.example .env
npm run check
npm start
```

## Configure

```env
DISCORD_TOKEN=your_discord_token
DISCORD_CLIENT_ID=your_discord_client_id
COMMAND_PREFIX=!
PROJECT_NAME=Longyan
BOT_NAME=Tianji
MAX_CONCURRENT_TASKS=10
MEMORY_DB_PATH=./longyan-memory.db
DOCKER_SOCKET=/var/run/docker.sock
DOCKER_NETWORK=none
AUTO_PULL_IMAGES=true
PYTHON_IMAGE=python:3.11-slim
NODE_IMAGE=node:20-slim
BROWSER_HEADLESS=true
BROWSER_TIMEOUT_MS=45000
TASK_TIMEOUT_MS=120000
REPLY_WAIT_MS=60000
CODE_TIMEOUT_MS=30000
SERPAPI_KEY=
```

`DOCKER_NETWORK=none` keeps executed code offline. Set it to `bridge` only when you deliberately want network access inside code containers.

## Commands

```text
!help
!name
!health
!queue
!session
!status task_id
!cancel task_id
```

## Execute

Browser work:

```text
!exec open https://example.com screenshot
!exec open github.com scrape selector:h1
!exec open example.com links
!exec open example.com page text
!exec open example.com fill:"#search" text:"discord bot" press:Enter
```

Code:

```text
!exec run python code: print(sum(range(100)))
!exec run javascript code: console.log(new Date().toISOString())
```

Files:

```text
!exec generate pdf content:"Daily brief"
!exec create excel data:[{"name":"Longyan","role":"project"},{"name":"Tianji","role":"operator"}]
!exec make image text:"Longyan Tianji"
!exec export json data:{"project":"Longyan","bot":"Tianji"}
```

Research:

```text
!exec research public web for browser automation
!exec search wikipedia for command queue design
```

Chained work:

```text
!exec open https://example.com screenshot then generate pdf content:"Captured example.com"
!exec run python code: print("ready") then create excel data:[{"status":"ready"}]
```

## Memory

```text
!memory set project Longyan
!memory get project
!memory list
!memory delete project
```

## Shape

The entry file only boots the runtime. The real work lives in small modules:

```text
src/config.js
src/command-planner.js
src/orchestrator.js
src/discord-handler.js
src/browser-agent.js
src/code-runner.js
src/file-generator.js
src/research-agent.js
src/memory.js
src/utils.js
```

## License

MIT.
