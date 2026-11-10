# CloudBase 部署指南

CloudBase 版本包含身份认证、宠物档案、出行计划、好物收藏和购物清单、个人资料、社区及服务留言。现有线上静态文件仍需换成下面生成的 CloudBase 构建。

## 验证 CloudBase 身份认证

在环境的身份认证配置里启用邮箱验证码和邮箱密码登录，配置邮件发送，并把测试站域名加入 Web 安全域名。本地测试时也添加实际使用的本地开发域名。密码规则需允许项目现有的 6 位密码。

```sh
VITE_CLOUDBASE_ENV_ID=rival-hookworm-d6g40w9co7b966aca npm run dev
```

打开开发地址，用真实邮箱注册，输入邮件验证码，刷新确认会话仍然有效，再退出并使用邮箱密码重新登录。设置 `VITE_CLOUDBASE_ENV_ID` 后此预览模式停用 Supabase 客户端。

[CloudBase Web 身份认证文档](https://docs.cloudbase.net/api-reference/webv3/authentication)

## 配置宠物档案和照片

1. 在目标环境的 PostgreSQL SQL 编辑器运行 [pets.sql](../cloudbase/pets.sql)。脚本创建 `public.pawsup_pets` 和私有存储桶 `pawsup-pet-photos`，使用 `GRANT` 和 RLS 按当前登录账号限制读写。
2. 在本地预览登录后打开 `/pets`，创建带照片的档案，再刷新、编辑和删除。用另一个浏览器或隐私窗口登录第二个账号，确认不会看到第一个账号的档案。验证照片权限时，用第二个账号尝试为第一个账号的对象路径申请新签名链接。已签发的链接在到期前可用。

[CloudBase PG 数据权限](https://docs.cloudbase.net/database/postgresql/secure-data) · [PG 云存储权限](https://docs.cloudbase.net/storage/pg/quickstart)

## 配置社区

先执行 `pets.sql` 和 `profiles.sql`，再在同一 CloudBase PG 环境执行 [community.sql](../cloudbase/community.sql)。脚本创建社区表和独立的帖子图片桶。登录用户可浏览已发布帖子，上传但未发布的图片只允许上传者读取。服务意向仅申请者和帖子作者可见，申请者可以取消。作者昵称在写入时保存，个人资料表和头像桶继续保持私有。

用两个账号验证图文帖子、图片、点赞、评论和关注。在一个账号发布服务帖，另一个账号提交意向并取消，分别查看个人中心的发送和接收记录。

新环境按顺序执行 `pets.sql`、`trips.sql`、`shopping.sql`、`profiles.sql`、`community.sql`、`service-contact.sql`、`service-identity.sql`。已执行并验收的环境可直接构建。

## 构建和上传前端

在 CloudBase 环境 `rival-hookworm-d6g40w9co7b966aca` 中开通静态网站托管。安装 CloudBase CLI 后，在 `pawsup-web` 目录执行以下命令。

```sh
tcb login --intl false
npm ci
VITE_CLOUDBASE_ENV_ID=rival-hookworm-d6g40w9co7b966aca \
  VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_SUPABASE_ANON_KEY= npm run build
tcb hosting deploy ./dist / -e rival-hookworm-d6g40w9co7b966aca --verify
```

也可以在静态网站托管控制台上传 `dist` 里的文件和子目录，使 `index.html` 位于站点根目录。将索引文档和错误页面都设置为 `index.html`，以便刷新 `/community`、`/pets` 或帖子详情时由 Vue Router 接管。生产站点绑定已完成 ICP 备案的自定义域名，按控制台提示配置 DNS 和 HTTPS。

参考 [Vue SPA 托管指南](https://docs.cloudbase.net/recipes/add-hosting-vue) 和 [上传命令](https://docs.cloudbase.net/cli-v1/hosting/deploy)。

## 后端切换与上线验收

以上构建命令启用 CloudBase，并清除本次构建中的 Supabase 配置。天气与驾车路线、AI 宠物助手的旧云函数仍待迁移，CloudBase 版本暂时隐藏这些入口。

CloudBase 从空环境启动，用户在新站重新注册。旧 Supabase 账号、业务记录和图片无需导入。新建的宠物、帖子、图片及购物清单仍须按当前登录用户校验访问权限。

生产切换前，在 CloudBase 环境中验证登录、刷新会话、宠物档案、图文发帖、评论和点赞、服务意向、出行、购物清单及个人中心。再从中国大陆网络访问站点，验证深层链接刷新、图片加载和业务请求均可用，并确认浏览器发出的业务请求已经切到 CloudBase。
