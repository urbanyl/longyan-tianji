# Longyan / Tianji 源代码安全审计报告

报告编号：AH-CODE-2026-0042  
审计日期：2026年7月  
审计对象：Longyan / Tianji – 自动化任务执行引擎与Discord操作员系统  
审计类型：整体源代码安全审计 + 功能点人工源代码审计  
审计机构：安恒信息

## 1. 管理摘要

安恒信息对 Longyan / Tianji 项目开展了整体源代码安全审计与功能点人工源代码审计。本次审计覆盖 Discord 指令入口、任务编排、浏览器自动化、Docker 代码执行、文件生成、互联网检索、SQLite 记忆存储、配置与基础校验脚本等核心模块。

审计结论：项目具备清晰的模块化设计，并已在 Docker 代码执行、SQL 参数化、文件名净化、任务超时和回复裁剪等方面建立基础安全控制。但由于该系统面向 Discord 消息直接触发浏览器操作、代码执行、文件生成与记忆读写，当前版本仍存在较高的越权调用、任意目标访问、浏览器沙箱弱化、共享会话隔离不足、供应链锁定不足等风险。建议在生产环境上线或扩大使用范围前完成高风险项整改。

综合风险评级：高风险  
上线建议：有条件通过。仅建议在受控测试环境或可信 Discord 服务器内运行；生产化部署前应完成身份授权、URL 出站控制、浏览器隔离、容器安全加固和依赖锁定。

## 2. 审计范围

本次审计覆盖以下源码与配置文件：

| 文件 | 审计重点 |
| --- | --- |
| `index.js` | Discord 客户端启动、事件绑定、进程生命周期 |
| `src/config.js` | 环境变量、运行时限制、路径与 Docker 配置 |
| `src/discord-handler.js` | 指令解析、用户交互、任务状态与文件回复 |
| `src/orchestrator.js` | 队列、任务状态机、步骤调度、取消与健康检查 |
| `src/command-planner.js` | 自然语言指令拆分、浏览器/代码/文件/检索分类 |
| `src/browser-agent.js` | Playwright 浏览器自动化、页面操作、脚本执行 |
| `src/code-runner.js` | Docker 容器代码执行、资源限制、镜像拉取 |
| `src/file-generator.js` | PDF、Excel、图片、JSON 生成与临时文件管理 |
| `src/research-agent.js` | Wikipedia、DuckDuckGo、SerpAPI 检索 |
| `src/memory.js` | SQLite 任务与记忆存储 |
| `src/utils.js` | 输入解析、URL 标准化、字符串裁剪、文件名净化 |
| `scripts/check.js` | JavaScript 语法检查脚本 |
| `package.json` | 依赖、脚本、运行时声明 |
| `.env.example` | 部署配置样例 |
| `Dockerfile.sandbox` | 沙箱镜像样例 |

## 3. 审计方法

本次工作采用人工源码审计为主、结构化风险建模为辅的方式执行，重点关注：

1. Discord 指令入口是否具备鉴权、授权、频率限制与审计追踪。
2. 浏览器自动化是否存在 SSRF、任意脚本执行、会话串扰和沙箱绕过风险。
3. Docker 代码执行是否具备足够的容器边界、资源限制、网络隔离和供应链控制。
4. 文件生成与附件回传是否存在路径穿越、任意文件暴露、公式注入或临时文件残留。
5. SQLite 存储是否存在 SQL 注入、跨用户数据访问、敏感信息持久化问题。
6. 第三方依赖与镜像是否具备锁定、审计和更新机制。
7. 任务状态机、取消机制、超时机制和队列设计是否满足可靠性与抗滥用要求。

说明：当前仓库未包含 `package-lock.json`，因此未能基于锁文件执行确定性的依赖漏洞复现审计。依赖安全结论基于 `package.json`、代码调用面和供应链控制策略进行评估，正式上线前仍需补充 SCA 扫描。

## 4. 架构安全评价

Longyan / Tianji 采用 Node.js 运行时，入口文件负责初始化 Discord 客户端，并将任务交由 Orchestrator 统一调度。CommandPlanner 根据用户输入将任务拆分为 browser、code、file、research 或 general 步骤。BrowserAgent 负责 Playwright Chromium 操作，CodeRunner 负责通过 Docker 运行 Python 或 JavaScript 片段，FileGenerator 负责生成附件，MemoryManager 负责 SQLite 持久化。

该架构的主要优点如下：

- 模块边界清晰，浏览器、代码执行、文件生成、检索和记忆存储之间职责分离。
- SQLite 查询大部分使用参数化语句，未发现典型 SQL 拼接注入路径。
- Docker 执行默认配置包含 `NetworkMode=none`、只读根文件系统、内存限制、CPU 限制与 PID 限制。
- 生成文件名经过 `safeFilename` 净化，降低了直接路径穿越风险。
- Discord 回复内容存在长度裁剪，附件数量存在上限。

同时，该架构的安全边界高度依赖 Discord 指令入口。如果入口无授权控制，则浏览器操作、代码执行、文件生成和记忆读取能力会被任何可发消息的用户间接调用，导致整体风险显著放大。

## 5. 风险评级标准

| 等级 | 定义 |
| --- | --- |
| 严重 | 可直接导致主机级控制、真实密钥泄露、大规模数据泄露或不可接受的业务中断 |
| 高 | 可导致未授权代码执行、跨租户数据访问、内部网络访问、敏感功能滥用 |
| 中 | 可导致局部数据泄露、拒绝服务、配置绕过、供应链风险或安全边界削弱 |
| 低 | 安全加固不足、审计性不足、错误处理不足或可靠性隐患 |

## 6. 主要审计发现

### AH-01 未建立 Discord 指令级授权控制

风险等级：高

影响模块：`index.js`、`src/discord-handler.js`

证据位置：

- `index.js:38` 启用 `GatewayIntentBits.MessageContent`
- `src/discord-handler.js:16-21` 注册 `exec`、`run`、`cancel`、`memory`、`session` 等高敏感指令
- `src/discord-handler.js:183-190` 仅校验消息前缀和机器人作者，未校验用户、角色、服务器或频道授权

风险说明：

当前任何能够向机器人可见频道发送指定前缀消息的非机器人用户，均可触发浏览器自动化、Docker 代码执行、文件生成、记忆写入、任务取消与会话查询。该行为在企业环境中属于高敏感操作入口无授权控制，可导致功能滥用、资源耗尽、跨用户数据读取和间接数据外传。

整改建议：

- 增加允许服务器、允许频道、允许用户和允许角色配置。
- 对 `exec/run`、`memory list/get/delete`、`session <id>`、`cancel <id>` 设置分级权限。
- 默认拒绝未知服务器和私信场景。
- 记录操作审计日志，包括操作者、频道、命令类型、任务编号、执行结果和附件清单。

### AH-02 浏览器自动化存在任意目标访问与 SSRF 风险

风险等级：高

影响模块：`src/command-planner.js`、`src/browser-agent.js`、`src/utils.js`

证据位置：

- `src/command-planner.js:48` 从用户输入中提取任意 URL 或域名
- `src/utils.js:88-93` `normalizeUrl` 自动补全 `https://`
- `src/browser-agent.js:34-39` 直接对用户输入 URL 执行 `page.goto`

风险说明：

系统允许 Discord 用户驱动浏览器访问任意 URL。若部署环境可访问内网、云元数据服务、管理后台或本机服务，攻击者可利用该能力进行 SSRF、内网探测、页面截图、链接枚举或敏感页面文本提取。结合截图和正文读取能力，风险进一步扩大。

整改建议：

- 建立 URL 出站访问策略，默认禁止内网地址、回环地址、链路本地地址、云元数据地址和非 HTTP(S) 协议。
- 对域名解析后的 IP 进行二次校验，防止 DNS rebinding。
- 对浏览器任务设置独立网络出口或代理策略。
- 将截图、正文提取、链接枚举能力纳入更高权限指令。

### AH-03 允许用户触发页面上下文脚本执行

风险等级：高

影响模块：`src/command-planner.js`、`src/browser-agent.js`

证据位置：

- `src/command-planner.js:55` 解析 `eval:` 字段
- `src/command-planner.js:69` 将 `evaluate` 放入浏览器输入
- `src/browser-agent.js:89-91` 直接执行 `page.evaluate(input.evaluate)`

风险说明：

`eval:` 能力允许用户在目标页面上下文执行 JavaScript。虽然执行位置是浏览器页面上下文而非 Node.js 主进程，但该能力可读取页面 DOM、Cookie 可见数据、LocalStorage、表单内容，并可发起页面上下文网络请求。若浏览器会话复用或访问了内部系统，该功能可能造成敏感信息泄露或越权操作。

整改建议：

- 默认禁用 `eval:` 功能。
- 若确需保留，应仅限管理员角色，并限制为预定义动作模板。
- 对返回数据进行敏感字段脱敏。
- 每个任务使用独立无状态浏览器上下文，任务结束后立即销毁。

### AH-04 Chromium 启动参数关闭浏览器沙箱

风险等级：高

影响模块：`src/browser-agent.js`

证据位置：

- `src/browser-agent.js:19` 使用 `--no-sandbox` 与 `--disable-setuid-sandbox`

风险说明：

浏览器自动化会加载用户指定的不可信网页。关闭 Chromium 沙箱会削弱浏览器漏洞利用后的隔离边界。对于可访问公网或不可信站点的自动化系统，该配置显著增加浏览器逃逸后的主机风险。

整改建议：

- 在支持的运行环境中移除 `--no-sandbox` 和 `--disable-setuid-sandbox`。
- 使用非 root 用户运行服务进程。
- 在容器化部署中启用 seccomp、AppArmor/SELinux、只读文件系统和最小 Linux capabilities。
- 将浏览器进程与 Discord 控制面分离部署。

### AH-05 浏览器会话在用户与任务之间共享

风险等级：高

影响模块：`src/browser-agent.js`

证据位置：

- `src/browser-agent.js:8-12` BrowserAgent 持有单一 `browser/context/page`
- `src/browser-agent.js:24-31` 初始化后复用同一 context 和 page
- `src/browser-agent.js:33` 使用锁串行化操作，但未提供用户级隔离

风险说明：

当前实现将所有 Discord 用户的浏览器任务复用到同一个浏览器上下文和页面。该设计可能造成 Cookie、LocalStorage、页面状态、已登录会话、上一任务 DOM 等跨用户残留。攻击者可通过后续命令读取或利用前一任务状态，形成跨用户数据泄露和业务越权。

整改建议：

- 每个任务创建独立 browser context，任务结束后关闭。
- 对需要长期会话的场景使用显式 sessionId，并实施访问控制。
- 默认清理 Cookie、LocalStorage、IndexedDB、权限授权和下载缓存。
- 将共享页面模式仅作为受控调试模式。

### AH-06 Docker 代码执行沙箱仍需进一步加固

风险等级：中高

影响模块：`src/code-runner.js`、`src/config.js`、`.env.example`

证据位置：

- `src/code-runner.js:62-81` 创建 Docker 容器并设置资源限制
- `src/code-runner.js:71-79` 配置内存、CPU、PID、只读根文件系统和 tmpfs
- `src/config.js:44-47` 默认自动拉取 `python:3.11-slim` 与 `node:20-slim`
- `.env.example` 默认 `AUTO_PULL_IMAGES=true`

风险说明：

Docker 沙箱已配置若干资源限制，具备一定安全基础。但当前未显式设置容器用户、capability drop、`no-new-privileges`、seccomp profile、镜像 digest 固定和根文件系统挂载策略。Node/Python 官方镜像默认行为随上游变化，自动拉取可变标签会带来供应链不确定性。服务进程需要访问 Docker socket，一旦 Node.js 进程被攻破，攻击者可能进一步控制宿主机 Docker 能力。

整改建议：

- 固定镜像 digest，关闭生产环境自动拉取。
- 设置 `User` 为非 root UID/GID。
- 添加 `CapDrop: ['ALL']`、`SecurityOpt: ['no-new-privileges:true']` 和受控 seccomp profile。
- 将 Docker 执行服务与 Discord 控制服务拆分，使用最小权限中间服务代替直接暴露 Docker socket。
- 对代码输入长度、输出日志大小和运行次数设置硬限制。

### AH-07 队列与资源消耗控制不足

风险等级：中

影响模块：`src/orchestrator.js`、`src/code-runner.js`、`src/file-generator.js`、`src/browser-agent.js`

证据位置：

- `src/orchestrator.js:31-34` 所有任务直接进入队列
- `src/orchestrator.js:37-47` 仅按全局并发数调度
- `src/code-runner.js:95` 读取容器完整日志后再返回
- `src/browser-agent.js:96` 可执行 fullPage 截图
- `src/file-generator.js:98-102` 临时文件仅在 shutdown 时清理

风险说明：

当前缺少用户级限流、频道级限流、最大队列长度、最大命令长度、最大日志字节数、最大截图尺寸和临时文件保留策略。攻击者可通过大量任务、大输出代码、超长页面截图或文件生成造成内存、磁盘、CPU 或 Discord 回复能力耗尽。

整改建议：

- 增加每用户、每频道、每服务器限流和配额。
- 设置最大队列长度与拒绝策略。
- 限制命令长度、代码长度、日志读取字节数、截图最大高度和附件总大小。
- 对临时文件实施 TTL 清理，并在每个任务完成后回收无引用文件。

### AH-08 任务取消机制不能强制中断正在执行的底层操作

风险等级：中

影响模块：`src/orchestrator.js`、`src/code-runner.js`、`src/browser-agent.js`

证据位置：

- `src/orchestrator.js:146-153` 取消活动任务时仅更新任务状态
- `src/orchestrator.js:58-61` 步骤之间检查 `task.cancelled`

风险说明：

活动任务取消后，底层浏览器导航、点击、截图或 Docker 容器执行不一定立即中断。当前取消逻辑更接近状态标记，只有在步骤返回后才进入取消判断。对于长时间阻塞操作，用户感知为已取消，但资源仍可能持续占用。

整改建议：

- 为每个任务引入 AbortController 或等效取消令牌。
- Docker 任务取消时立即 kill 对应容器。
- Playwright 操作取消时关闭对应 page/context。
- 区分 `cancel_requested`、`cancelled` 和 `terminated` 状态。

### AH-09 记忆与会话查询缺少数据隔离

风险等级：中

影响模块：`src/discord-handler.js`、`src/memory.js`

证据位置：

- `src/discord-handler.js:80-112` `memory` 命令操作全局 key-value 存储
- `src/discord-handler.js:114-127` `session` 可接受任意 sessionId 参数
- `src/memory.js:114-118` 按 session_id 查询任务，无调用者校验

风险说明：

Memory 存储为全局命名空间，任何被允许调用命令的用户都可列出、读取、删除或覆盖记忆项。Session 查询允许传入任意 sessionId，在 Discord 用户 ID 可被观察或猜测的场景中，可能导致跨用户任务历史泄露。

整改建议：

- 将 memory key 绑定 owner、guild、channel 或明确 scope。
- 普通用户仅能查看自己的 session。
- 管理员查询他人 session 时记录审计日志。
- 对记忆值进行敏感信息扫描与脱敏展示。

### AH-10 供应链与依赖锁定不足

风险等级：中

影响模块：`package.json`、`src/code-runner.js`

证据位置：

- 仓库未包含 `package-lock.json`
- `package.json` 使用 semver 范围依赖
- `src/config.js:44-47` Docker 镜像使用可变标签并默认自动拉取

风险说明：

缺少锁文件会导致不同部署环境安装到不同依赖解析结果，降低漏洞复现、回滚和合规审计能力。Docker 镜像可变标签和自动拉取策略会引入不可控的供应链变化。

整改建议：

- 提交 `package-lock.json`，使用 `npm ci` 部署。
- 在 CI 中执行依赖漏洞扫描和许可证扫描。
- Docker 镜像固定 digest，并建立镜像准入策略。
- 定期生成 SBOM，纳入版本发布材料。

### AH-11 文件生成存在公式注入与临时目录治理不足风险

风险等级：中

影响模块：`src/file-generator.js`、`src/config.js`

证据位置：

- `src/file-generator.js:49-52` 使用用户数据生成 Excel
- `src/file-generator.js:74-83` 将 JSON 和 buffer 写入临时目录
- `src/config.js:57` `TEMP_DIR` 可由环境变量控制
- `src/file-generator.js:98-102` cleanup 会清理临时目录内文件

风险说明：

Excel 生成未对以 `=`, `+`, `-`, `@` 开头的单元格进行公式转义。若生成的文件被人工打开，可能触发公式注入风险。临时目录由环境变量决定，虽然文件名已净化，但仍建议限制临时目录必须位于应用专用目录，避免误配置导致清理非预期目录中的文件。

整改建议：

- Excel 写入前对公式前缀进行转义或按字符串类型写入。
- 校验 `TEMP_DIR` 必须位于应用工作目录下的专用子目录。
- 添加临时文件大小、数量、保留时间限制。
- 对附件回传进行 MIME 类型和路径边界校验。

### AH-12 错误信息与执行结果脱敏不足

风险等级：低至中

影响模块：`src/discord-handler.js`、`src/orchestrator.js`、`src/research-agent.js`

证据位置：

- `src/discord-handler.js:162-170` 将任务结果或错误直接回复 Discord
- `src/orchestrator.js:100-106` 汇总步骤结果
- `src/research-agent.js:21-25` 外部请求错误被纳入结果结构

风险说明：

当前系统会将任务输出、页面文本、错误消息、外部检索结果和文件路径等内容回复至 Discord。若任务访问了敏感页面或异常中包含内部路径、令牌片段、服务地址，可能造成信息泄露。

整改建议：

- 对 token、Authorization、Cookie、API key、内部 IP、文件绝对路径等进行统一脱敏。
- 错误回复采用用户可读的安全摘要，详细堆栈仅写入受控日志。
- 对附件路径仅返回文件名，不在公开频道暴露本地绝对路径。

## 7. 功能点人工审计结论

### 7.1 Discord 指令处理

功能完整性：基本可用。支持 help、health、queue、status、cancel、memory、session、exec 等命令。  
主要问题：缺少授权模型、缺少限流、缺少敏感命令分级。  
整改优先级：最高。

### 7.2 任务编排与队列

功能完整性：任务状态机清晰，具备 pending、running、completed、failed、cancelled 等状态。  
主要问题：队列无长度限制，取消不具备底层强制中断能力，任务失败后状态保存依赖 finally 流程。  
整改优先级：高。

### 7.3 浏览器自动化

功能完整性：支持打开网页、填表、按键、点击、抓取、链接枚举、正文读取、截图和页面脚本执行。  
主要问题：共享浏览器上下文、任意 URL 访问、`eval:` 高危能力、关闭 Chromium 沙箱。  
整改优先级：最高。

### 7.4 Docker 代码执行

功能完整性：支持 Python 与 JavaScript 片段执行，具备超时、内存、CPU、PID、只读根文件系统和无网络默认配置。  
主要问题：未显式非 root、未 drop capabilities、未固定镜像 digest、日志大小不受控、Docker socket 信任边界过大。  
整改优先级：高。

### 7.5 文件生成

功能完整性：支持 PDF、Excel、图片、JSON 与截图附件。  
主要问题：Excel 公式注入防护不足，临时文件治理不足，附件路径边界建议增强。  
整改优先级：中。

### 7.6 检索模块

功能完整性：支持 SerpAPI、Wikipedia、DuckDuckGo 聚合检索。  
主要问题：外部请求目标固定，整体风险相对可控；但检索结果和错误信息仍需脱敏与审计。  
整改优先级：中低。

### 7.7 记忆存储

功能完整性：SQLite 初始化、任务记录、记忆增删查具备基础能力。  
安全评价：参数化查询较好，未发现明显 SQL 注入点。  
主要问题：数据权限边界不足，记忆内容未加密，敏感信息长期保留策略缺失。  
整改优先级：中。

## 8. 正向安全控制

本次审计确认以下控制具备正向价值：

- SQLite 业务查询主要采用参数化占位符，降低 SQL 注入风险。
- 代码执行容器默认无网络，且配置了内存、CPU、PID、只读根文件系统和 tmpfs。
- 文件名生成使用 `safeFilename`，降低路径穿越和非法字符风险。
- SVG 文本内容使用 XML 转义，降低生成图片中的 XML 注入风险。
- Discord 回复对文本长度和附件数量设置限制。
- 任务具备全局超时机制，避免部分长任务无限运行。

## 9. 合规与运营建议

从企业化运营角度，建议补充以下能力：

1. 身份与权限：接入 Discord role allowlist、guild allowlist、channel allowlist 和管理员审批机制。
2. 审计日志：记录所有高风险命令和输出文件，不允许仅依赖 Discord 消息作为审计记录。
3. 数据保护：对记忆库、任务结果和附件实施保留周期、加密和删除策略。
4. 安全基线：生产环境关闭自动拉取镜像，固定依赖锁文件和 Docker 镜像 digest。
5. 网络治理：浏览器与代码执行网络应具备不同 egress policy，默认禁止访问内网。
6. 监控告警：对任务失败率、队列长度、附件大小、容器超时、异常域名访问设置告警。
7. 发布流程：建立 CI 检查，包括语法检查、依赖审计、许可证审计、容器镜像扫描和基础单元测试。

## 10. 分阶段整改路线

### 第一阶段：上线前必须完成

- 为 Discord 指令增加授权、限流和审计日志。
- 禁用或管理员限定 `eval:`。
- 禁止浏览器访问内网、回环、链路本地和云元数据地址。
- 每个浏览器任务使用独立 context，并在结束后销毁。
- 移除 Chromium `--no-sandbox`，或将浏览器运行在额外隔离的受控容器中。
- 提交锁文件并固定部署依赖。

### 第二阶段：生产强化

- Docker 容器增加非 root、capability drop、no-new-privileges 和 seccomp。
- 固定 Docker 镜像 digest，关闭生产自动拉取。
- 增加日志大小、截图大小、附件大小、队列长度和临时文件 TTL 限制。
- 加密或分级保护 SQLite 任务历史与 memory 数据。
- 对 Excel 单元格进行公式注入防护。

### 第三阶段：企业治理

- 建立 SBOM 与版本发布安全签核。
- 接入集中日志与 SIEM。
- 建立异常命令检测策略。
- 定期开展依赖漏洞扫描、容器镜像扫描和渗透测试。
- 建立数据保留、删除和导出流程。

## 11. 结论

Longyan / Tianji 当前代码结构清晰，工程可维护性较好，适合作为自动化任务执行引擎和 Discord 操作员系统的原型或受控内部工具。其主要风险并非单点代码缺陷，而是多个高权限能力通过 Discord 消息入口聚合后缺少企业级权限控制、隔离控制和出站访问控制。

安恒信息建议将本项目评级为“高风险，允许受控测试，不建议直接生产暴露”。完成第一阶段整改后，可进入小范围可信用户试运行；完成第二阶段整改并补充 CI/SCA/镜像扫描后，可按企业内部自动化平台标准继续推进生产化评估。

审计机构：安恒信息  
报告编号：AH-CODE-2026-0042  
报告状态：正式版
