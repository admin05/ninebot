# 九号出行签到 Arcadia 脚本

这是从九号出行签到脚本整理出的 Arcadia / Node.js 版本。脚本会读取环境变量中的账号信息，调用九号出行签到接口，并在结束后通过 Bark 推送运行摘要。

## Arcadia 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `NINEBOT_ACCOUNTS` | 是 | 九号账号信息，格式为 `deviceId:Authorization`。多个账号可用分号、英文逗号或换行分隔。 |
| `BARK` | 否 | Bark key。Arcadia 环境中已配置时会自动推送结果；未配置时只输出日志。 |
| `NINEBOT_BASE_URL` | 否 | 九号接口地址，默认 `https://cn-cbu-gateway.ninebot.com`。 |
| `NINEBOT_TIMEOUT_MS` | 否 | 请求超时时间，默认 `15000`。 |
| `BARK_BASE_URL` | 否 | Bark 服务地址，默认 `https://api.day.app`。 |

`NINEBOT_ACCOUNTS` 示例：

```text
deviceId1:AuthorizationToken1;deviceId2:AuthorizationToken2
```

不要把真实 `Authorization`、Bark key 或抓包日志提交到仓库。

## 运行

```bash
node ninebot-arcadia.js
```

Arcadia 中建议配置为定时任务运行该脚本。脚本需要 Node.js 18 或更高版本，因为它使用了内置 `fetch`。

## 账号获取

原脚本通过代理工具抓取九号 App 签到接口中的请求头：

- `Authorization`
- `device_id`

Arcadia 不能直接依赖代理工具的持久化存储，所以这里改为把两项组合后写入 `NINEBOT_ACCOUNTS` 环境变量。
