# PawsUp H5

大陆上线方案与当前迁移状态见 [CloudBase 部署指南](docs/CLOUDBASE.md)。

Vue 3 + TypeScript + Vite + Vant。此目录为新工程，根目录 HTML 原型保留不变。

## 本地运行

```sh
npm ci
npm run dev
npm run build
```

打开终端打印的地址。不要双击 index.html，也不要将源码 HTML 当作构建产物。

## 已实现

- 首页、社区搜索及分类、关注列表、帖子详情。
- 单图压缩发布、点赞、评论、关注、自己的动态删除。
- 宠物档案新增、编辑、删除、图片上传。
- 个人中心、我的发布、喜欢的动态。
- 登录注册表单验证与 Supabase Auth 适配。
- 手机端自适应、Vercel SPA 路由配置。

## 数据与认证边界

默认不连接后端。未登录时所有业务路由重定向至 `/auth`；本地测试账号为 `admin / 123456`，错误账号或密码无法登录。注册支持本地账号，密码以随机盐和 SHA-256 摘要保存，仅供流程演示，不构成生产认证。会话存储在 sessionStorage，同一标签页刷新保留；退出后清除。旧版本地体验资料不会被当作有效登录。体验资料与社区数据保存在 `pawsup_frontend_v1`，同一浏览器共用，**不具备多用户隔离**。示例帖子用于验证界面。前端删除及权限限制不构成生产安全控制。

复制 `.env.example` 为 `.env`，填入 Supabase URL 与公开 anon key，再重启 Vite，即启用真实邮箱密码认证。若开启邮箱验证，注册后须先确认邮件。业务数据和图片此阶段仍然留在浏览器，并未接入 PostgreSQL / Storage；正式上线前必须补齐数据库表、RLS、Storage 策略和认证用户关联。不要在 VITE 环境变量中配置 service_role 或其他服务端秘密。

原型中的出行、服务申请与订单、商品、AI、后台不在本轮实现范围。旧 HTML 数据不自动迁移。

## GitHub 与 Vercel

仓库尚未创建或推送。可将整个工作区上传 GitHub，在 Vercel 导入仓库，并将 Root Directory 设置为 `pawsup-web`；Framework 选择 Vite，Build Command 为 `npm run build`，Output Directory 为 `dist`。需要真实认证时在 Vercel 配置两个 VITE_SUPABASE 环境变量，并在 Supabase 配置站点及重定向 URL。

## 验收流程

1. 首页进入社区，搜索关键词及切换分类，查看帖子详情。
2. 登录页输入错误账号或密码，确认无法进入；使用 admin / 123456 登录进入首页。
3. 新增宠物，上传图片，编辑并刷新验证保留。
4. 发布带图动态，详情页点赞、评论；个人中心验证我的发布和喜欢列表。
5. 关注示例作者，社区切换关注；取消关注后列表同步。
6. 删除自己的动态、删除宠物，取消确认时记录应保留。
7. 刷新 `/posts/sample-1`、`/pets` 等路径，验证 SPA 路由。
8. 退出登录，确认返回登录页，直接访问业务路径仍需登录；本地业务数据保留。

## 结构

`src/views` 页面；`src/components` 公共组件；`src/stores/community.ts` 类型化本地数据层；`src/services/supabase.ts` 客户端连接；`src/types.ts` 数据类型；`public/images` 从原型提取的本地素材。

## Outing page

Implemented at `/outing`: multi-pet selection, nine scene categories, city/date/time, itinerary preview, packing checklist, local save/edit/delete, and text download. Home navigation and trip planning link to this page. Weather, navigation, route optimization and bookings are not connected. Pet names are saved as snapshots; editing a trip after changing pet records requires reselection. Existing source prototype files remain unchanged.

Run `npm test` with Node.js 22.6+ for scene order, Shanghai timezone and departure validation tests. Browser QA covered saving, refresh persistence and editing without duplicate records.

## Community module

The community now includes a service exchange area (find a provider / offer help), neighbor posts (chat, companions, lost-pet assistance, services), search, following, category filters, load more, and post details. Publishing supports text-only posts or up to three compressed images, optional pet associations, location/time, service direction/type/price, editing, and an unsaved-change warning. Local service intentions can be recorded once per active post intention and cancelled; they do not send messages, create orders, process payment, or verify providers. Existing posts are retained through a versioned sample-data migration.

Browser QA verified service direction switching, intention recording and duplicate prevention, publishing a text-only companion post, and editing the same record. Community validation/filter tests are included in npm test.

## Goods module

Implemented `/goods` and `/goods/:id`: seven catalog filters, five prototype products, search, price/rating sorting, product image galleries, specifications, demo rating/sales labels, wishlist, and a local shopping list. Home product cards, bottom navigation and profile wishlist link to the catalog. Missing catalog categories show an empty state rather than fabricated products. Shopping list supports quantities 1-99, removal and cent-based totals; it never creates orders or handles payment. Wishlist and shopping list use the existing local store and remain shared within the browser (no per-user isolation yet). Product ratings, prices and sales are explicitly demonstration data, with no real customer review claims.

Browser QA verified wishlist filtering, product detail, adding items, quantity updates, subtotal and refresh persistence. npm test includes filtering, sorting and cart arithmetic tests.

## Profile module

The profile page now follows the shared reference layout and reads actual local counts: pet profiles, own posts, liked posts, followed authors, likes received, saved products, trips and service intentions. Includes dialogs for own/liked posts, following, trips, service intention history/cancellation, account settings and help. Profile editing supports nickname, compressed avatar and biography; local nicknames survive login refresh through the demo session and display-name map, and configured Supabase authentication updates the name in user metadata. Avatar and biography remain local and are keyed by account identifier. Business records remain browser-wide until backend user ownership is implemented. No fabricated followers, coupons or orders are displayed.

Browser QA verified nickname-required validation, profile saving, refresh, and saved-trip display.

## Pet ownership and prerequisites

Pet records now include ownerId (the current account identifier). Home, pet manager, profile, publishing and outings only read currentPets; unowned legacy records and other users pets are not shown as the current users pets. No example pets are auto-filled. Legacy records are retained unchanged rather than attributed to an arbitrary account.

Publish and outing routes require an owned pet and show an add-pet prompt when empty; acceptance opens the creation form with a return path. Saving a pet resumes the original publish/outing/service detail. Submission guards re-check pet existence; service intentions also require a pet. This is frontend/local isolation, not a substitute for Supabase RLS. Earlier README references to example-pet planning or text publishing without a pet are superseded by this rule.

## Server foundation

Supabase database migrations, RLS policies, private media buckets, authenticated health function, test suite and an explicit API adapter are now included. Setup/status/limitations: [docs/BACKEND.md](docs/BACKEND.md). No cloud project has been created and no deployment performed. Current UI business data still uses the local demo store; the API adapter is prepared but not silently enabled. AI inference remains out of scope until this foundation is deployed and frontend data is migrated.
