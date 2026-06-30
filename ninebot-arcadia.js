#!/usr/bin/env node

"use strict";

const SCRIPT_NAME = "九号出行签到";
const DEFAULT_BASE_URL = "https://cn-cbu-gateway.ninebot.com";
const DEFAULT_TIMEOUT_MS = 15000;

const config = {
  accounts: parseAccounts(process.env.NINEBOT_ACCOUNTS || ""),
  baseUrl: process.env.NINEBOT_BASE_URL || DEFAULT_BASE_URL,
  timeoutMs: Number.parseInt(process.env.NINEBOT_TIMEOUT_MS || "", 10) || DEFAULT_TIMEOUT_MS,
  barkKey: process.env.BARK || "",
  barkBaseUrl: process.env.BARK_BASE_URL || "https://api.day.app",
};

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${SCRIPT_NAME}] failed: ${message}`);
  await pushBark("失败", message);
  process.exitCode = 1;
});

async function main() {
  if (!globalThis.fetch) {
    throw new Error("当前 Node.js 版本不支持 fetch，请在 Arcadia 使用 Node.js 18 或更高版本运行");
  }

  if (config.accounts.length === 0) {
    throw new Error("未配置 NINEBOT_ACCOUNTS，格式示例：deviceId:Authorization;deviceId2:Authorization2");
  }

  console.log(`[${SCRIPT_NAME}] start, accounts=${config.accounts.length}`);

  const results = [];
  for (const account of config.accounts) {
    try {
      const result = await signAccount(account);
      results.push({ account, ok: true, message: result });
      console.log(`[${SCRIPT_NAME}] ${maskDeviceId(account.deviceId)} ${result}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ account, ok: false, message });
      console.error(`[${SCRIPT_NAME}] ${maskDeviceId(account.deviceId)} ${message}`);
    }
  }

  const failed = results.filter((item) => !item.ok);
  const title = failed.length === 0 ? "成功" : failed.length === results.length ? "失败" : "部分失败";
  const body = results
    .map((item) => `${maskDeviceId(item.account.deviceId)}：${item.message}`)
    .join("\n");

  await pushBark(title, body);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

async function signAccount(account) {
  const status = await requestJson(`/portal/api/user-sign/v2/status?t=${Date.now()}`, account);
  if (status.code !== 0) {
    return status.msg || "查询失败";
  }

  const consecutiveDays = status.data?.consecutiveDays ?? 0;
  if (status.data?.currentSignStatus === 1) {
    return `已签 | 连签 ${consecutiveDays}天`;
  }

  const sign = await requestJson("/portal/api/user-sign/v2/sign", account, {
    method: "POST",
    body: JSON.stringify({ deviceId: account.deviceId }),
  });

  if (sign.code !== 0) {
    return sign.msg || "签到失败";
  }

  const rewards = (sign.data?.rewardList || [])
    .map((reward) => (reward.rewardValue ? `+${reward.rewardValue}N币` : ""))
    .filter(Boolean)
    .join(" ");
  const latestStatus = await requestJson(`/portal/api/user-sign/v2/status?t=${Date.now()}`, account);
  const latestDays = latestStatus.data?.consecutiveDays ?? consecutiveDays + 1;

  return `连签 ${latestDays}天${rewards ? ` | ${rewards}` : ""} | 成功`;
}

async function requestJson(path, account, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method: options.method || "GET",
      headers: buildHeaders(account),
      body: options.body,
      signal: controller.signal,
      redirect: "manual",
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`接口返回不是 JSON: ${text.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function buildHeaders(account) {
  return {
    Accept: "application/json, text/plain, */*",
    Authorization: account.token,
    "Content-Type": "application/json",
    device_id: account.deviceId,
    language: "zh",
    from_platform_1: "1",
    Origin: "https://h5-bj.ninebot.com",
    Referer: "https://h5-bj.ninebot.com/",
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Segway v6",
  };
}

async function pushBark(status, detail) {
  if (!config.barkKey) {
    console.log(`[${SCRIPT_NAME}] BARK 未配置，跳过推送`);
    return;
  }

  const title = `${SCRIPT_NAME} ${status}`;
  const summary = trimText(detail || status, 1800);
  const url = `${config.barkBaseUrl.replace(/\/+$/, "")}/push`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_key: config.barkKey,
        title,
        body: summary,
        group: "Arcadia",
        icon: "https://h5-bj.ninebot.com/favicon.ico",
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      console.warn(`[${SCRIPT_NAME}] Bark 推送失败: HTTP ${response.status} ${text.slice(0, 120)}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[${SCRIPT_NAME}] Bark 推送失败: ${message}`);
  }
}

function parseAccounts(raw) {
  return raw
    .split(/[\n;,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const splitAt = item.indexOf(":");
      if (splitAt <= 0) {
        throw new Error("NINEBOT_ACCOUNTS 格式错误，应为 deviceId:Authorization，多个账号用分号或换行分隔");
      }

      return {
        deviceId: item.slice(0, splitAt).trim(),
        token: item.slice(splitAt + 1).trim(),
      };
    })
    .filter((account) => account.deviceId && account.token);
}

function maskDeviceId(deviceId) {
  if (deviceId.length <= 8) {
    return `${deviceId.slice(0, 2)}***`;
  }

  return `${deviceId.slice(0, 4)}***${deviceId.slice(-4)}`;
}

function trimText(text, maxLength) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}
