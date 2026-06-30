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

## 常见问题

如果日志显示已经读取到账号，但请求失败：

```text
[九号出行签到] start, accounts=1
[九号出行签到] abcd***wxyz 网络请求失败: ...
```

说明 `NINEBOT_ACCOUNTS` 已生效，问题出在 Arcadia 运行环境访问九号接口的网络链路。常见原因包括 NAS/Docker 无法访问外网、DNS 解析失败、代理未配置、TLS 证书异常、接口连接超时。

脚本会输出底层错误的 `code`、`hostname`、`address`、`port` 等信息，按错误码排查：

- `ENOTFOUND` / `EAI_AGAIN`：DNS 问题，检查 Arcadia 容器或 NAS 的 DNS。
- `ETIMEDOUT` / `UND_ERR_CONNECT_TIMEOUT`：连接超时，检查网络出口、代理或防火墙。
- `ECONNRESET` / `CERT_...`：TLS 或连接被重置，检查代理、证书或运营商网络。
- `ECONNREFUSED`：目标地址或代理端口拒绝连接。

## 账号获取

原脚本通过代理工具抓取九号 App 签到接口中的请求头：

- `Authorization`
- `device_id`

Arcadia 不能直接依赖代理工具的持久化存储，所以这里改为把两项组合后写入 `NINEBOT_ACCOUNTS` 环境变量。
