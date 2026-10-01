# dsh-usage

在 [DSH（DeepSeek Harness）](https://github.com/deepseek-ai/dsh) 侧栏查看 **智谱 GLM Code Plan 剩余额度** 与 **DeepSeek API 账户余额**。

侧栏底部「设置」行右侧有一个用量小图标，点击弹出统计面板：

- **智谱 Code Plan**：5 小时 / 每周窗口的剩余百分比、重置时间、积分余额；剩余 <50% 转警示色、低于阈值转错误色
- **DeepSeek**：账户余额（含赠送/充值构成）；未配置 DeepSeek 凭据时整卡隐藏，绝不显示伪造的 0
- 移动端窄屏自动单列；明暗主题跟随宿主；界面文案中英双语

## 安装

```bash
dsh plugin --profile <你的profile> add github:gmugu/dsh-usage
```

重启 DSH 后生效。卸载：

```bash
dsh plugin --profile <你的profile> remove dsh-usage
```

## 配置

设置 → 插件 → 用量统计（或直接编辑 profile 补丁层的插件 `config`）：

| 字段 | 默认 | 说明 |
|---|---|---|
| `zhipuEnabled` | `true` | 启用智谱 Code Plan 额度 |
| `zhipuApiKey` | 空 | 智谱 API Key；留空则自动复用 DSH 已配置的智谱凭据（如 `ZAI_CODING_CN_API_KEY`） |
| `zhipuCredentialRef` | `ZAI_CODING_CN_API_KEY` | 自动模式的凭据引用名 |
| `zhipuType` | `2` | 套餐类型：`1`=个人，`2`=团队 |
| `zhipuOrganization` | 空 | **团队套餐必填**，浏览器 DevTools 里 `quota/limit` 请求的 `bigmodel-organization` 头 |
| `zhipuProject` | 空 | **团队套餐必填**，同上的 `bigmodel-project` 头 |
| `zhipuEndpoint` | `https://open.bigmodel.cn` | 智谱站点（国际站为 `https://api.z.ai`） |
| `deepseekEnabled` | `true` | 启用 DeepSeek 余额 |
| `deepseekApiKey` | 空 | 手动填写的 DeepSeek API Key；留空自动探测 `DEEPSEEK_API_KEY` 凭据及已存的 deepseek 记录 |
| `deepseekCredentialRef` | `DEEPSEEK_API_KEY` | 自动模式的凭据引用名 |
| `refreshMinutes` | `5` | 后台刷新间隔（分钟） |
| `warnRemainingPct` | `20` | 剩余百分比低于该值时进度条转错误色 |
| `qwenEnabled` | `true` | 启用千问 Token Plan 用量（数据来自官方千问 CLI 的登录态） |
| `qwenCredentialRef` | `QWEN_TOKEN_PLAN_CN_API_KEY` | DSH 中该套餐的凭据引用名 |

### 卡片显示门控

某供应商未在 DSH 模型中配置 API Key 时，对应用量卡整体隐藏：智谱探测 `ZAI_CODING_CN_API_KEY`（及 zai 相关凭据记录），DeepSeek 探测 `DEEPSEEK_API_KEY`，千问探测 `QWEN_TOKEN_PLAN_CN_API_KEY`（该 Key 不用于查询，仅作为"你在 DSH 使用该套餐"的依据；千问数据经官方千问 CLI 的登录态获取）。

### 千问 Token Plan

数据来自官方 [`@qianwenai/qianwen-cli`](https://www.npmjs.com/package/@qianwenai/qianwen-cli)：

```sh
npm install -g @qianwenai/qianwen-cli
qianwen login
```

插件在宿主侧执行 `qianwen usage summary --format json`（固定参数、不经 shell、15 秒超时），读取 `token_plan` 的总 Credits / 剩余 Credits 与订阅到期时间；登录凭据始终由 CLI 自己保管。CLI 未安装或未登录时，千问卡会显示对应的安装/登录指引。

### 团队套餐必读

智谱团队套餐的用量接口要求携带 `bigmodel-organization` 与 `bigmodel-project` 请求头，缺了会返回空 `data:{}`（HTTP 200、`success:true`，极易误判为"没有套餐"）。获取方法：

1. 浏览器打开 `https://bigmodel.cn/coding-plan/` 并登录
2. F12 → Network → 刷新，找到 `quota/limit` 请求
3. 复制 Request Headers 里的 `bigmodel-organization: org-xxxx` 与 `bigmodel-project: proj-xxxx`

个人套餐把 `zhipuType` 改为 `1` 即可，无需这两个头。

## 隐私

- 所有 API Key 只保存在宿主侧（DSH 凭据库 / 插件配置），**从不下发浏览器**
- 插件读取的内容只有额度/余额数字；不写会话日志，不上报数据
- 数据经宿主本地 HTTP 端点 `/dsh-usage/quota` 提供，仅含统计数字

## 数据来源

- 智谱：`GET {endpoint}/api/monitor/usage/quota/limit?type=<1|2>`，`unit:3` 为 5 小时窗口、`unit:6` 为每周窗口，剩余 % = 100 − `percentage`
- DeepSeek：`GET https://api.deepseek.com/user/balance`

## 已知限制

- 仅实测 DSH `0.2.0-rc.2` + Node 24（`engines.dsh` 声明兼容 0.2 线）
- 团队套餐必须配置组织/项目 ID，插件无法用 API Key 反查
- DeepSeek 官方无订阅套餐接口，这里显示的是 API 账户余额

## 致谢

- 请求形态与响应结构参考了社区插件的踩坑记录：[takboo/dsh-usage-state](https://github.com/takboo/dsh-usage-state)、[focksor/pi-glm-quota](https://github.com/focksor/pi-glm-quota)

## 许可

[MIT](LICENSE)
