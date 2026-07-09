# Longyan

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.js.org/)
[![Playwright](https://img.shields.io/badge/Playwright-browser%20control-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)
[![Docker](https://img.shields.io/badge/Docker-sandbox-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![SQLite](https://img.shields.io/badge/SQLite-memory-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![License](https://img.shields.io/badge/license-MIT-f7c948?style=for-the-badge)](LICENSE)
[![Made by Urbanyl](https://img.shields.io/badge/made%20by-Urbanyl%201920-0c111d?style=for-the-badge)](https://github.com/urbanyl)

Longyan is a sharp Discord command engine built around Tianji, a fast operator bot with browser control, sandboxed code execution, file generation, public web research, and long-term memory.

The identity is Chinese in pinyin, with no Hanzi in the public naming:

Project name: Long Yan  
Bot name: Tian Ji  
Creator signature: Yu Cheng, known online as Urbanyl alias 1920

## What It Does

Tianji turns a Discord channel into a command deck.

- Open pages, click selectors, scrape text, and capture screenshots
- Run Python or JavaScript inside Docker containers
- Generate PDFs, Excel workbooks, and images
- Keep task history and key-value memory in SQLite
- Queue multiple jobs without losing the thread
- Return generated files directly inside Discord

## Stack

| Layer | Choice |
| --- | --- |
| Discord gateway | Discord.js v14 |
| Browser control | Playwright Chromium |
| Code runtime | Docker containers |
| Files | PDFKit, XLSX, Sharp |
| Memory | SQLite |
| Language | Node.js |

## Quick Start

```bash
npm install
npx playwright install
cp .env.example .env
npm start
```

Fill `.env` before launch:

```env
DISCORD_TOKEN=your_discord_token
DISCORD_CLIENT_ID=your_discord_client_id
COMMAND_PREFIX=!
PROJECT_NAME=Longyan
BOT_NAME=Tianji
FOUNDER_NAME=Yu Cheng
FOUNDER_ALIAS=Urbanyl 1920
MAX_CONCURRENT_TASKS=10
MEMORY_DB_PATH=./longyan-memory.db
DOCKER_SOCKET=/var/run/docker.sock
SERPAPI_KEY=
```

## Commands

Run anything:

```text
!exec go to https://github.com and screenshot
!exec open example.com and scrape selector:h1
!exec run python code: print(sum(range(100)))
!exec execute javascript code: console.log(new Date().toISOString())
!exec generate pdf with content: Longyan daily brief
!exec create excel with data: [{"name":"Yu","role":"founder"},{"name":"Tianji","role":"operator"}]
!exec make image with text: Longyan Tianji
!exec search public web for Discord automation
```

Check work:

```text
!status task_id
!cancel task_id
!session
```

Use memory:

```text
!memory project Longyan
!memory get project
```

Show the name card:

```text
!name
```

## Runtime

Node.js handles Discord, orchestration, memory, files, and API calls. Playwright handles the browser. Docker isolates code execution. SQLite stores history without any external database.

Default limits are practical on purpose: ten concurrent tasks, Docker memory caps, short code timeouts, local storage, and clean file output in `temp`.


## License

MIT.
