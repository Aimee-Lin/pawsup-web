# V2 本机数据库

使用项目锁定的 Supabase CLI 在本机 Docker 中运行 PostgreSQL、认证、邮件收件箱、PostgREST 和图片存储。它复现 PawsUp 的主要业务流程，使用空库和示例商品，与生产 CloudBase 完全隔离。CloudBase 的 SDK、平台身份和权限集成仍需在部署时验证。

使用 Colima 时，先运行 `colima start --vm-type vz --cpu 4 --memory 6`，并用 `docker info` 确认 Docker 已就绪。然后在 `pawsup-web1` 运行：

```sh
npm ci
npm run db:start
npx supabase status -o env
```

用本机状态输出中的 API URL 和公开密钥创建 `.env.development.local`：

```dotenv
VITE_CLOUDBASE_ENV_ID=
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=填入本机的 PUBLISHABLE_KEY 或 ANON_KEY
```

然后运行 `npm run dev -- --port 5176 --strictPort`。到 http://127.0.0.1:5176/auth 注册两个测试账号，用 http://127.0.0.1:54324 查看注册邮件。数据库管理界面在 http://127.0.0.1:54323。开发时使用 `supabase start`、`supabase stop` 和本地迁移，避免执行 `supabase db push`。

本地 AI 和地图页面使用原有 Supabase Edge Function 接口。联调前复制 `supabase/functions/.env.example` 到同目录的 `.env`，配置模型和高德 Web 服务密钥，并把实际本机站点地址加入 `ALLOWED_ORIGINS`。使用 `npx supabase functions serve --env-file supabase/functions/.env`。V2 的 CloudBase 云函数另按 [V2 联调指南](V2-TOOLS.md) 验证。
