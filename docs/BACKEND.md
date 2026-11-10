# PawsUp 服务端基础工程

技术栈：Supabase Auth + PostgreSQL + RLS + Storage + Edge Functions。Vercel 负责现有 Vue 前端。

## 当前交付状态

已提供并测试：

- 真实 PostgreSQL 迁移，15 张业务表、约束、索引、注册资料触发器。
- 数据库用户归属和 RLS；私有图片桶及上传、读取、删除策略。
- 服务端发帖/出行/服务意向的宠物前置校验。
- 只读示例商品目录、收藏、购物清单。
- AI 对话、消息、用量表结构。模型调用和额度扣减尚未实现。
- `health` Edge Function：真实 Token 验证、来源白名单、数据库就绪检查。
- 前端 `src/services/backend.ts` 接口适配器：服务健康检查、宠物 CRUD、图片上传、签名 URL。

**尚未完成、也未冒充完成的部分：**云项目创建和部署，真实邮件投递，真实 Storage 上传，完整前端远程数据切换，本地演示数据迁移，AI 调用。现有界面依旧使用本地业务数据；配置 Supabase 只会启用现有真实认证路径，并不会自动把浏览器记录上传。

## 1. 创建 Supabase 项目

在 Supabase Dashboard 创建项目，保存数据库密码，等待项目就绪。

在项目连接/API 设置中取得：

- Project URL。
- Publishable key（旧项目的 anon key 也支持）。这是前端公开配置。

数据库密码、service_role/secret key、模型密钥不要放在前端，也不要提交 Git。不要把这些秘密发到聊天里。后续需要的模型密钥只放 Edge Function Secrets。

本地 `admin / 123456` 不会成为云端账号，也不会拥有管理员权限。云端必须注册真实邮箱账号；本工程认证最低密码长度为 6 位，当前注册页面按产品要求限制为恰好 6 位；登录不截断已有密码。

## 2. 初始化云端数据库

以下命令均在 `pawsup-web` 目录执行：

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npm run db:push
```

首次迁移会依次应用：

1. `supabase/migrations/202611090001_core.sql`
2. `supabase/migrations/202611090002_storage.sql`

在 Dashboard 的 SQL Editor 执行 `supabase/seed.sql`，初始化 5 件**示例商品**。脚本不创建虚假账号、宠物或订单。

也可以不用 CLI，在一个空的 Supabase 项目中按上述顺序执行这三个文件。CLI 迁移和手动 SQL Editor 初始化二选一，不要混用，否则需先对齐迁移历史。

这些迁移用于本项目的新数据库。已有同名表的数据库不要直接套用；先备份并审查兼容性。不要对云端运行 reset。

## 3. 配置认证和前端

复制 `.env.example` 为 `.env`，填写：

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
```

重启 `npm run dev`。在 Auth URL Configuration 中设置 Site URL，并加入：

- `http://127.0.0.1:5173`
- `http://localhost:5173`
- 后续实际 Vercel 生产域名及需要的完整确认邮件返回 URL。

认证建议开启邮箱确认；生产使用前配置和验证 SMTP 邮件投递。仅本地 `.env` 或 Vercel 环境变量包含公开前端 key，不要填写 service_role key。

注册触发器会创建 `profiles`。现有账户在初始化时也会补齐资料。更改昵称后远程业务层应同时更新 profiles.display_name；Auth metadata 只承担登录显示，本轮界面尚未切换到这套业务层。

## 4. 部署健康检查函数

```sh
cp supabase/functions/.env.example supabase/functions/.env
```

在复制后的文件设置 `ALLOWED_ORIGINS` 为允许的**完整来源**，逗号分隔，无路径和尾部斜杠。加入实际 Vercel URL；预览域名需逐项添加，不使用 `*`。

```sh
npx supabase secrets set --env-file supabase/functions/.env
npm run functions:deploy
```

`health` 在 config.toml 中使用 `verify_jwt=false`，因为函数内部通过 Supabase Auth `getUser(token)` 校验完整用户 Token，**不是免登录接口**。缺少/伪造 Token 会返回 401；来源不在白名单返回 403；表未就绪返回 503。

调用：`GET https://YOUR_PROJECT_REF.supabase.co/functions/v1/health`，携带真实用户会话的 `Authorization: Bearer ACCESS_TOKEN` 和公开 API key。`backend.health()` 已封装此流程。不要把访问 Token 写入代码或提交仓库。

成功示例：

```json
{"service":"pawsup","schemaVersion":1,"authenticated":true,"database":"ready","ai":"not_configured"}
```

这个检查验证认证与 profiles 查询，不代表所有业务或 AI 已上线。

## 5. 数据结构与访问规则

| 数据 | 表 | 客户端规则 |
| --- | --- | --- |
| 公开用户资料 | profiles | 已登录用户可读，不存邮箱、密码或医疗记录；仅本人可改指定字段 |
| 私有宠物档案 | pets | owner_id = auth.uid()；禁止改归属 |
| 社区内容 | posts / post_pets | 已发布内容对已登录用户可见；仅作者可修改；关联宠物须同属作者 |
| 评论点赞 | comments / likes | 只能对可见帖子互动，不可冒充其他用户；点赞唯一 |
| 关注 | follows | 只能维护自己的关注关系，不能关注自己 |
| 私有行程 | trips | 仅本人可读写；所有 pet_ids 须归本人；新的出发时间须在未来 |
| 服务意向 | service_applications | 申请人与帖子作者可读；申请人可取消待处理意向；不能申请自己的服务 |
| 示例商品 | products | 客户端只读，不产生真实订单 |
| 收藏与清单 | product_favorites / cart_items | 仅本人可读写；数量 1–99；不可改商品定价 |
| AI 会话 | ai_conversations | 仅本人；关联宠物归本人 |
| AI 消息、用量 | ai_messages / ai_usage | 本人只读，可信服务端写入；当前没有模型调用接口 |

所有归属使用 Supabase Auth 用户 UUID，不使用邮箱、昵称或前端传来的用户 ID。普通登录用户不能写 AI assistant 消息或用量，避免伪造服务端输出与计费数据。后续 AI 函数必须自行验证身份、查询归属并进行原子限额控制。

已有 AI 会话引用的宠物暂不允许直接删除；后续接入时应先解除会话宠物关联，再删除档案。行程保存 ID 快照，删除宠物后修改旧行程需重新选择有效宠物。

## 6. 图片

私有桶：`pet-photos`、`post-images`、`avatars`；单张最大 5MB，只接受 JPEG/PNG/WebP。

路径：`用户UUID/随机UUID.扩展名`。数据库保存对象路径，不保存 Base64 或永久签名 URL。

- 宠物照片：只有本人能读取。
- 帖子图片：作者能读；其他已登录用户仅可读已发布帖引用的对象。
- 头像：只有本人或公开资料引用后的已登录用户能读。
- 所有上传/替换/删除只允许自己的目录。

使用 `backend.upload()` 上传，`backend.imageUrl()` 取得 5 分钟签名链接。已经签出的 URL 在过期前仍可能有效，下架内容不会瞬间撤销已签出的链接。删除业务记录不自动物理删除 Storage 文件；后续补充有审计的孤儿文件清理，不在数据库触发器中直接删除 Storage 元数据。

## 7. 本地开发（可选）

完整 Supabase 本地栈需要 Docker Desktop。本机目前未安装/提供 Docker 运行时，未启动完整栈。

```sh
npm run db:start
# 仅本地开发库：清空并重放迁移和 seed，禁止指向云端
npm run db:reset
npm run functions:serve
npm run db:types
npm run db:stop
```

`db:types` 输出的自动生成文件只在成功连接本地数据库后生成。当前适配器没有声称已生成远程数据库类型。

## 8. 验证

```sh
npm run backend:check
npm run backend:test
npm test
npm run build
```

数据库测试使用内存 PostgreSQL（PGlite），执行**原样迁移**，对 Supabase 管理的 auth/storage 表和 auth.uid 作最小模拟，创建两个普通 authenticated 账号进行真实 SQL/RLS 检查。覆盖越权读写、无宠物发帖、跨用户出行、隐藏帖子互动、重复意向、私有图片、只读商品、AI 客户端写入等。

HTTP 测试覆盖 Token、CORS、方法限制及数据库错误返回；verify 函数为测试替身，不模拟真实 Auth 服务。Edge 入口通过独立 TypeScript 检查，尚未在 Deno/Supabase 云端执行。

云端初始化后仍需用两个真实账号验收：注册确认邮件、宠物隔离、图片上传及签名、社区互动、服务意向，以及健康检查。通过后再逐项将前端 localStorage 读写迁到接口。浏览器演示数据不会静默导入；迁移须明确选择记录并把 Base64 图片转为 Storage 对象。

官方参考：

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/docs/guides/functions/auth

## 2026-11-10：宠物档案前端接入

配置 Supabase 后，宠物管理现在调用真实数据库与私有 Storage；归属改为认证用户 UUID，页面加载会同步远程宠物并刷新短期签名图片链接。新增、编辑和删除只有远程成功后才更新界面，失败保留表单并提示。当前会话已通过云端列表读取验证，上传和写入仍需用实际宠物操作验收。旧本地档案不自动上传：若发现旧记录，管理页提供逐份同步入口。社区、行程、收藏、服务意向和个人简介仍在本机，不能视为所有业务已经上云。


## 社区云端接入（2026-11-10）

已使用现有数据库与 RLS 接入社区图文发布、读取、编辑、删除、点赞、评论及基于 UUID 的关注；无需重新运行 bootstrap。社区不再混入本机示例，旧本机帖子首次切换时备份到 `pawsup_legacy_posts_backup_v1`，不会自动发布。图片使用私有 post-images 桶、5 分钟签名 URL；页面提供刷新云端动态。宠物档案仍是发帖前置条件，本阶段图文发布暂不提供关联宠物选择，宠物档案保持私有。

服务帖子可发布，但咨询/接单意向仍为本机演示，没有真实预约、消息或支付。图片上传成功但帖子保存失败可能留下尚未引用的文件；删除帖子尚不自动清理 Storage 文件。社区作者头像暂用默认图，个人资料头像尚未同步。

验证：生产构建通过，25 项自动测试通过（含数据库权限与帖子映射）。实际双账号图文发布验收尚需用户登录后执行：账号 A 发布一条带图帖子，刷新与重新登录后确认；账号 B 查看、点赞、评论、关注，确认没有编辑/删除入口。再回到 A 检查互动。当前浏览器处于登录页，未代用户创建或发布测试帖子。


## 出行计划云端接入（2026-11-10）

出行计划通过现有 trips 表保存、读取、修改、删除，按 owner_id 和 RLS 隔离。前端使用上海时间录入，转 UTC 存储，读取时统一转换为上海时间。同行宠物从当前用户云端档案选择，后端触发器再次验证宠物所有权与未来出发时间。行前清单、场景顺序与路线示意一起保存，仍支持下载 TXT。

首次切换前旧本机行程备份到 pawsup_legacy_trips_backup_v1，不自动上传或混入当前账号的云端列表。云端错误保留编辑内容，历史列表提供刷新入口。已删除宠物在历史行程显示“宠物档案已删除”，修改时需要重新选择有效宠物。地图、真实路线、天气和预约均未接入。

无需追加 SQL 或重新运行 bootstrap。构建与 27 项自动测试通过；已在登录账号下验证出行页读取与“0 份云端行程”弹窗正常、没有加载报错。未代用户创建测试行程；保存、重登保留和第二账号隔离仍需真实账号操作验收。


## 好物收藏与购物清单（2026-11-10）

收藏与购物清单通过现有 product_favorites / cart_items 按账号保存，支持收藏/取消、加购、数量修改（1–99）、移除、刷新与重新登录读取。商品继续使用示例目录，尚无真实订单、支付、库存、物流。首次接入将原本机收藏与清单备份至 pawsup_legacy_shopping_backup_v1，不会直接合并到当前登录账号。写入成功后才更新页面，失败提示保留旧数据；同一商品写入期间阻止重复操作。

出行场景首次进入与取消编辑时默认空选；编辑已有行程按已保存场景还原。无需追加 SQL。


## 个人资料云端接入（2026-11-10）

个人昵称、简介和头像存入 profiles / avatars，profiles 是展示资料的唯一权威来源；Auth metadata 仅用于注册初始昵称，不在编辑时同时双写，避免部分成功造成昵称回退。头像先上传私有桶，再写入当前用户的 profiles，签名链接有效 5 分钟；页面进入时按 3 分钟缓存刷新，加载失败提供重试。社区帖子作者昵称、头像也读取 profiles。个人资料是社区公开展示内容，宠物档案依旧私有。

没有自动上传旧浏览器个人资料；旧 profileDetails 缓存保留。如需要保留此前仅在本机的个人头像，请重新选择并保存。上传成功但资料写入失败可能留下未引用文件，暂不自动清理 Storage。无需 SQL。真实头像保存、刷新/重登后的显示需要用户操作验收。


## 服务意向云端接入（2026-11-10）

现有 service_applications 表已接入提交、查看、取消。“我的”按咨询/接单显示自己提交的意向，另有“收到的意向”；社区意向弹窗也分“我提交的 / 我收到的”。查询由 RLS 限定为提交人与帖子作者，前端不读取联系方式或他人宠物。提交前明确提示对方可见昵称与意向；取消仅允许提交人操作，并在双方列表显示取消状态。前端和数据库均防止重复有效意向、向自己帖子申请及无宠物档案申请。

旧本机意向备份到 pawsup_legacy_applications_backup_v1，不自动提交给其他用户。没有预约、支付、站内私信、主动通知和服务人员核验；对方需打开列表刷新查看。帖子永久删除会按现有外键级联删除对应意向。无需 SQL。

构建及 33 项测试通过，真实登录账号下收到的意向查询与空列表正常。尚未代用户提交意向，双账号提交流程需用户验收：A 发布服务，B 提交咨询，A 查看收到的意向，B 取消，A 刷新确认取消状态。
