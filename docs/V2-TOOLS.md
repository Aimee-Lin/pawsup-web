# V2 助手与出行工具联调

`pawsup-web1` 可先使用[本机数据库](LOCAL-PG.md)开发。以下步骤适用于 CloudBase SDK 和云函数的集成验证。

`pawsup-web1` 的 `dev` 分支是本地开发副本。完整验证 V1 的云端功能时，给本地前端连接一个独立的 CloudBase PG 测试环境。

1. 在测试环境启用邮箱验证码和密码登录，配置发信。
2. 在测试环境的 PostgreSQL 编辑器依次执行 `cloudbase/` 下的 `pets.sql`、`trips.sql`、`shopping.sql`、`profiles.sql`、`community.sql`、`service-contact.sql`、`service-identity.sql`。这些脚本建立表、存储桶和权限。用两个新测试账号验证关注、粉丝和服务留言。
3. 将 `.env.example` 复制为 `.env.development.local`，填入测试环境 ID。启动时使用 `localhost`。该配置文件已被 Git 忽略。

```sh
npm run dev -- --host localhost --port 5176 --strictPort
```

这个端口单独保存浏览器会话。V1 的线上对照预览和纯本地演示预览可以继续使用各自的端口。

## 本机 TokenHub 问答

在 TokenHub 控制台开通模型并创建 TokenHub API Key。在被 Git 忽略的 `.env.development.local` 设置 `TOKENHUB_API_KEY` 和 `TOKENHUB_MODEL`，然后重启 Vite。本机代理使用广州接入点，密钥在服务端读取。线上联调时将同名变量填到云函数环境变量中。

## 本机天气与路线

在腾讯位置服务控制台创建 WebService API Key，把它填到本机 `.env.development.local` 的 `TMAP_WEBSERVICE_KEY`，再重启 Vite。如果腾讯地图跳转要求应用标识，按控制台设置填写 `TMAP_URI_REFERER`。出行页查询城市实况，填入地址后可按驾车耗时优化途经点顺序。

V2 云函数返回每个地点的 GCJ-02 经纬度。未来的小程序可以调用同一云函数，再用微信地图组件展示地点或接入腾讯路线规划插件。网页跳转链接用于当前 H5 界面。

## 启用 V2 云函数

在独立的 CloudBase 测试环境部署 `cloudbase/functions/pawsup-v2`。选择事件函数，入口 `index.main`，使用支持原生 fetch 的 Node.js 运行时，超时设为 30 秒，开启云端安装依赖。核对 CloudBase 的 FunctionsHttpApiAllow 和函数权限，仅允许非匿名登录用户调用。

在函数环境变量设置 `TOKENHUB_API_KEY`、`TOKENHUB_MODEL`（使用控制台已开通的模型 ID，例如 `deepseek-v3`）和 `TMAP_WEBSERVICE_KEY`（腾讯位置服务 WebService API）。密钥只放在云函数环境变量里。

```sh
VITE_CLOUDBASE_V2_TOOLS=true npm run dev -- --host localhost --port 5176 --strictPort
```

登录后，从首页打开 AI 宠物助手，从出行页打开天气与路线。验证问答、实况天气和更新时间、带途经点的驾车路线，以及从手机打开分段腾讯地图路线。开关关闭时，CloudBase 版本隐藏入口。

[CloudBase PG 云函数 SDK](https://docs.cloudbase.net/api-reference/webv3-pg/functions) · [TokenHub 快速入门](https://cloud.tencent.com/document/product/1823/130058) · [腾讯位置服务接口](https://cloud.tencent.com/developer/mcp/server/11471)
