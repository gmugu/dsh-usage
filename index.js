/** Host half: fetch DeepSeek balance + Zhipu Code Plan quota + Qwen Token Plan, serve one JSON endpoint. */
import { execFile, spawn } from 'node:child_process';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import z from '@deepseek-ai/schemastery';

export const inject = ['webServer', 'credentials'];

export const Config = z.object({
  zhipuEnabled: z.boolean().default(true).description('启用智谱 Code Plan 额度（未配置智谱凭据时不显示该卡）'),
  zhipuApiKey: z.string().default('').description('智谱 API Key（团队套餐 Key，留空则自动复用 DSH 已配置的智谱凭据）'),
  zhipuCredentialRef: z.string().default('ZAI_CODING_CN_API_KEY').description('自动模式的智谱凭据引用名'),
  zhipuType: z.number().default(2).description('套餐类型：1=个人，2=团队'),
  zhipuOrganization: z.string().default('').description('bigmodel-organization 请求头，如 org-xxxx'),
  zhipuProject: z.string().default('').description('bigmodel-project 请求头，如 proj-xxxx'),
  zhipuEndpoint: z.string().default('https://open.bigmodel.cn').description('智谱站点地址'),
  deepseekEnabled: z.boolean().default(true).description('启用 DeepSeek 余额（未配置 DeepSeek 凭据时不显示该卡）'),
  deepseekApiKey: z.string().default('').description('手动填写的 DeepSeek API Key（留空则自动复用 DSH 已配置的 DeepSeek 凭据）'),
  deepseekCredentialRef: z.string().default('DEEPSEEK_API_KEY').description('自动模式的凭据引用名'),
  qwenEnabled: z.boolean().default(true).description('启用千问 Token Plan 用量（数据来自官方千问 CLI 的登录态）'),
  qwenCredentialRef: z.string().default('QWEN_TOKEN_PLAN_CN_API_KEY').description('DSH 中该套餐的凭据引用名；未配置则隐藏千问卡'),
  refreshMinutes: z.number().default(5).description('后台刷新间隔（分钟）'),
  warnRemainingPct: z.number().default(20).description('剩余百分比低于该值时进度条转警示色'),
});

const ZHIPU_WINDOW_KINDS = { 3: 'hours', 6: 'week' };
const QWEN_CLI_PACKAGE = '@qianwenai/qianwen-cli';
const CLI_TIMEOUT_MS = 15000;
const CLI_MAX_BUFFER = 1024 * 1024;

function emptyState() {
  return {
    zhipu: null,
    deepseek: null,
    qwen: null,
    fetchedAt: null,
  };
}

export function apply(ctx, config) {
  const state = emptyState();
  let inflight = null;
  let lastAttempt = 0;
  let qwenCliEntry = undefined;

  async function fetchJson(url, headers) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      const text = await res.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = null; }
      if (!res.ok) {
        const detail = body && (body.error?.message || body.message) ? `：${body.error?.message || body.message}` : '';
        throw new Error(`HTTP ${res.status}${detail}`);
      }
      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  async function resolveCredential(refName, pattern) {
    try {
      const resolved = await ctx.credentials.resolve(refName);
      if (resolved?.value) return resolved.value;
    } catch {}
    try {
      const records = await ctx.credentials.listRecords();
      for (const entry of records) {
        if (!pattern.test(String(entry.key))) continue;
        if (entry.kind !== 'api-key') continue;
        const record = await ctx.credentials.readRecord(entry.key);
        if (record?.kind === 'api-key' && record.key) return record.key;
      }
    } catch {}
    return null;
  }

  async function refreshZhipu() {
    if (!config.zhipuEnabled) { state.zhipu = null; return; }
    const key = config.zhipuApiKey
      || await resolveCredential(config.zhipuCredentialRef || 'ZAI_CODING_CN_API_KEY', /zai|zhipu|bigmodel|glm/i);
    if (!key) { state.zhipu = null; return; }
    if (!state.zhipu) state.zhipu = { configured: true, windows: [], error: null };
    state.zhipu.configured = true;
    const headers = { Authorization: key, 'User-Agent': 'Mozilla/5.0 (DSH usage plugin)' };
    if (config.zhipuOrganization) headers['bigmodel-organization'] = config.zhipuOrganization;
    if (config.zhipuProject) headers['bigmodel-project'] = config.zhipuProject;
    const url = `${config.zhipuEndpoint.replace(/\/$/, '')}/api/monitor/usage/quota/limit?type=${config.zhipuType}`;
    const body = await fetchJson(url, headers);
    if (body && body.success === false) {
      throw new Error(typeof body.message === 'string' ? body.message : '接口返回失败');
    }
    const limits = body?.data?.limits;
    if (!Array.isArray(limits) || limits.length === 0) {
      throw new Error('未返回额度数据：请检查套餐类型 type 与组织/项目 ID 是否正确');
    }
    const windows = [];
    for (const item of limits) {
      const kind = ZHIPU_WINDOW_KINDS[item.unit];
      if (!kind) continue;
      const usedPct = typeof item.percentage === 'number' ? item.percentage : null;
      windows.push({
        kind,
        hours: item.unit === 3 ? item.number : undefined,
        usedPct,
        remainingPct: usedPct == null ? null : Math.max(0, Math.min(100, 100 - usedPct)),
        resetAt: typeof item.nextResetTime === 'number' ? item.nextResetTime : null,
        remainingCredits: typeof item.remaining === 'number' ? item.remaining : null,
        totalCredits: typeof item.usage === 'number' ? item.usage : null,
      });
    }
    windows.sort((a, b) => (a.kind === 'hours' ? -1 : 1) - (b.kind === 'hours' ? -1 : 1));
    state.zhipu.windows = windows;
    state.zhipu.error = null;
  }

  async function refreshDeepSeek() {
    if (!config.deepseekEnabled) { state.deepseek = null; return; }
    const key = config.deepseekApiKey
      || await resolveCredential(config.deepseekCredentialRef || 'DEEPSEEK_API_KEY', /deepseek/i);
    if (!key) { state.deepseek = null; return; }
    if (!state.deepseek) state.deepseek = { configured: true, balances: [], error: null };
    state.deepseek.configured = true;
    const body = await fetchJson('https://api.deepseek.com/user/balance', {
      Authorization: `Bearer ${key}`,
    });
    if (!body || body.is_available === false) {
      throw new Error('账户不可用或响应异常');
    }
    const balances = Array.isArray(body.balance_infos)
      ? body.balance_infos.map((info) => ({
          currency: info.currency,
          total: info.total_balance,
          granted: info.granted_balance,
          toppedUp: info.topped_up_balance,
        })).filter((b) => b.total != null)
      : [];
    state.deepseek.balances = balances;
    state.deepseek.error = null;
  }

  /** Locate the qianwen CLI package's Node entry under an absolute PATH directory (no .cmd/.ps1 shims). */
  async function findQwenCli() {
    if (qwenCliEntry !== undefined) return qwenCliEntry;
    qwenCliEntry = null;
    for (const dir of (process.env.PATH || '').split(';')) {
      const cleaned = dir?.trim();
      if (!cleaned || !/^[a-zA-Z]:[\\/]/.test(cleaned.replace(/"/g, ''))) continue;
      const pkgDir = join(cleaned.replace(/"/g, ''), 'node_modules', ...QWEN_CLI_PACKAGE.split('/'));
      const manifest = `${pkgDir}\\package.json`;
      try {
        await access(manifest);
        const pkg = JSON.parse(await readFile(manifest, 'utf8'));
        const bin = typeof pkg.bin === 'string' ? pkg.bin
          : pkg.bin && typeof pkg.bin === 'object' ? (pkg.bin.qianwen ?? pkg.bin[QWEN_CLI_PACKAGE] ?? Object.values(pkg.bin)[0])
          : null;
        if (typeof bin !== 'string') continue;
        const entry = pkgDir + (bin.startsWith('/') || bin.startsWith('\\') || /^[a-zA-Z]:/.test(bin) ? bin : '\\' + bin.replace(/^\.\//, ''));
        await access(entry);
        qwenCliEntry = entry;
        break;
      } catch {}
    }
    return qwenCliEntry;
  }

  function execNode(entry, args) {
    return new Promise((resolve) => {
      execFile(process.execPath, [entry, ...args], {
        timeout: CLI_TIMEOUT_MS,
        maxBuffer: CLI_MAX_BUFFER,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      }, (error, stdout, stderr) => {
        resolve({ error, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') });
      });
    });
  }

  function pickNumber(source, keys) {
    for (const key of keys) {
      const value = source?.[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
    }
    return null;
  }

  function normalizeEpoch(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value < 1e12 ? value * 1000 : value;
    }
    if (typeof value === 'string' && value) {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  async function refreshQwen() {
    if (!config.qwenEnabled) { state.qwen = null; return; }
    const credential = await resolveCredential(config.qwenCredentialRef || 'QWEN_TOKEN_PLAN_CN_API_KEY', /qwen|token.?plan|dashscope/i);
    if (!credential) { state.qwen = null; return; }
    if (!state.qwen) state.qwen = { error: null };
    const entry = await findQwenCli();
    if (!entry) {
      state.qwen = { ...state.qwen, error: 'cli-missing', credits: null, expiresAt: null };
      return;
    }
    const { error, stdout, stderr } = await execNode(entry, ['usage', 'summary', '--format', 'json']);
    let body = null;
    for (const text of [stdout, stderr]) {
      if (!text) continue;
      try { const parsed = JSON.parse(text); if (parsed && typeof parsed === 'object') { body = parsed; break; } } catch {}
    }
    if (body?.error?.code === 'AUTH_REQUIRED' || body?.error?.code === 'EAUTH' || body?.error?.code === 'TOKEN_EXPIRED') {
      state.qwen = { ...state.qwen, error: 'auth', credits: null, expiresAt: null, seats: [] };
      return;
    }
    if (!body || !body?.token_plan) {
      state.qwen = { ...state.qwen, error: 'query-failed', credits: null, expiresAt: null, seats: [] };
      return;
    }
    const plan = body?.token_plan ?? body?.tokenPlan ?? null;
    const total = pickNumber(plan, ['totalCredits', 'total_credits', 'total', 'credits']);
    const remaining = pickNumber(plan, ['remainingCredits', 'remaining_credits', 'remaining']);
    const addOn = pickNumber(plan, ['addonCredits', 'addon_credits', 'addOn', 'addon', 'extraCredits', 'extra_credits']);
    let usedRatio = pickNumber(plan, ['usedPct', 'used_pct', 'usedPercentage', 'used_percentage', 'percentage', 'usedRatio', 'used_ratio']);
    if (usedRatio != null && usedRatio <= 1) usedRatio *= 100;
    let remainingPct = null;
    if (total != null && remaining != null && total > 0) {
      remainingPct = Math.max(0, Math.min(100, (remaining / total) * 100));
    } else if (usedRatio != null) {
      remainingPct = Math.max(0, Math.min(100, 100 - usedRatio));
    }
    const expiresAt = normalizeEpoch(plan?.resetDate ?? plan?.reset_date ?? plan?.endTime ?? plan?.end_time)
      ?? normalizeEpoch(body?.subscription?.endTime);
    const seats = await refreshQwenSeats(entry);
    state.qwen = {
      error: null,
      credits: total != null || remaining != null ? { total, remaining, addOn } : null,
      remainingPct,
      expiresAt,
      seats,
    };
  }

  /** Per-seat credits of a team Token Plan: `subscription tokenplan seats`. */
  async function refreshQwenSeats(entry) {
    const { stdout, stderr } = await execNode(entry, ['subscription', 'tokenplan', 'seats', '--format', 'json']);
    let body = null;
    for (const text of [stdout, stderr]) {
      if (!text) continue;
      try { const parsed = JSON.parse(text); if (parsed && typeof parsed === 'object') { body = parsed; break; } } catch {}
    }
    if (!Array.isArray(body?.items)) return [];
    const seats = [];
    for (const item of body.items) {
      if (item?.status !== 'NORMAL' || !item?.memberId) continue;
      const seatTotal = Number(item?.cycle?.totalValue);
      const seatRemaining = Number(item?.cycle?.surplusValue);
      if (!Number.isFinite(seatTotal) || seatTotal <= 0) continue;
      seats.push({
        seat: String(item.memberId).slice(-6),
        total: seatTotal,
        remaining: Number.isFinite(seatRemaining) ? seatRemaining : null,
        expiresAt: normalizeEpoch(item?.cycle?.endTime),
      });
    }
    return seats;
  }

  async function refresh(force = false) {
    const now = Date.now();
    if (!force && inflight) return inflight;
    if (!force && now - lastAttempt < 60000) return null;
    lastAttempt = now;
    const tasks = [];
    tasks.push(refreshZhipu().catch((error) => {
      if (state.zhipu) state.zhipu.error = String(error?.message || error);
    }));
    tasks.push(refreshDeepSeek().catch((error) => {
      if (state.deepseek) state.deepseek.error = String(error?.message || error);
    }));
    tasks.push(refreshQwen().catch((error) => {
      if (state.qwen && typeof state.qwen.error === 'string') state.qwen.error = 'query-failed';
    }));
    inflight = Promise.all(tasks).then(() => {
      state.fetchedAt = Date.now();
      inflight = null;
    }).catch(() => {
      inflight = null;
    });
    return inflight;
  }

  ctx.effect(() => {
    const timer = setInterval(() => { void refresh(true); }, Math.max(1, config.refreshMinutes) * 60000);
    void refresh(true);
    return () => clearInterval(timer);
  }, 'dsh-usage: refresh timer');

  /** Qwen CLI device-flow login driven from the popup: init → user authorizes in browser → background poll completes. */
  let qwenLogin = null;
  let qwenLoginChild = null;

  async function startQwenLogin() {
    if (qwenLogin?.status === 'pending' && Date.now() < qwenLogin.expiresAt - 5000) return qwenLogin;
    if (qwenLoginChild) { try { qwenLoginChild.kill(); } catch {} qwenLoginChild = null; }
    const entry = await findQwenCli();
    if (!entry) {
      qwenLogin = { status: 'failed', message: 'cli-missing', url: null, expiresAt: 0 };
      return qwenLogin;
    }
    const { stdout: initOut, stderr: initErr } = await execNode(entry, ['auth', 'login', '--init-only', '--format', 'json']);
    let body = null;
    for (const text of [initOut, initErr]) {
      if (!text) continue;
      try { const parsed = JSON.parse(text); if (parsed && typeof parsed === 'object') { body = parsed; break; } } catch {}
    }
    const events = Array.isArray(body?.events) ? body.events : [];
    const already = events.find((e) => e?.event === 'already_authenticated');
    if (already) {
      qwenLogin = { status: 'ok', url: null, expiresAt: 0 };
      void refresh(true);
      return qwenLogin;
    }
    const code = events.find((e) => e?.event === 'device_code' && typeof e.verification_url === 'string');
    if (!code) {
      qwenLogin = { status: 'failed', message: 'init-failed', url: null, expiresAt: 0 };
      return qwenLogin;
    }
    const ttlSeconds = Number(code.expires_in_seconds) > 0 ? Number(code.expires_in_seconds) : 300;
    qwenLogin = {
      status: 'pending',
      url: code.verification_url,
      startedAt: Date.now(),
      expiresAt: Date.now() + ttlSeconds * 1000,
    };
    const child = spawn(process.execPath,
      [entry, 'auth', 'login', '--complete', '--timeout', String(Math.max(60, ttlSeconds - 10)), '--format', 'json'],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    qwenLoginChild = child;
    child.on('error', () => { qwenLoginChild = null; });
    child.on('exit', (exitCode) => {
      qwenLoginChild = null;
      if (!qwenLogin || qwenLogin.status !== 'pending') return;
      if (exitCode === 0) {
        qwenLogin = { status: 'ok', url: null, expiresAt: 0 };
        void refresh(true);
      } else if (Date.now() >= qwenLogin.expiresAt) {
        qwenLogin = { status: 'expired', url: null, expiresAt: 0 };
      } else {
        qwenLogin = { status: 'failed', message: 'complete-failed', url: null, expiresAt: 0 };
      }
    });
    return qwenLogin;
  }

  ctx.effect(() => {
    const disposeRoute = ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-usage/qwen-login',
      handler: async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'content-type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'method-not-allowed' }));
          return;
        }
        try { await startQwenLogin(); } catch (error) {
          qwenLogin = { status: 'failed', message: String(error?.message || error), url: null, expiresAt: 0 };
        }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify(qwenLogin ?? { status: 'failed', message: 'unknown' }));
      },
    });
    const disposeChild = () => { if (qwenLoginChild) { try { qwenLoginChild.kill(); } catch {} } };
    return () => { disposeRoute(); disposeChild(); };
  }, 'dsh-usage: qwen login route');

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-usage/quota',
    handler: async (req, res) => {
      try {
        const url = new URL(req.url, 'http://localhost');
        if (url.searchParams.get('refresh') === '1') await refresh(true);
        else if (!state.fetchedAt) await refresh(true);
      } catch {}
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify({
        zhipu: state.zhipu ? { ...state.zhipu } : null,
        deepseek: state.deepseek ? { ...state.deepseek } : null,
        qwen: state.qwen ? { ...state.qwen } : null,
        qwenLogin,
        fetchedAt: state.fetchedAt,
        thresholds: { warnRemainingPct: config.warnRemainingPct },
      }));
    },
  }), 'dsh-usage: quota route');
}
