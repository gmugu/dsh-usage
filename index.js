/** Host half: fetch DeepSeek balance + Zhipu Code Plan quota, serve one JSON endpoint. */
import z from '@deepseek-ai/schemastery';

export const inject = ['webServer', 'credentials'];

export const Config = z.object({
  zhipuEnabled: z.boolean().default(true).description('启用智谱 Code Plan 额度'),
  zhipuApiKey: z.string().default('').description('智谱 API Key（团队套餐 Key，留空则自动复用 DSH 已配置的智谱凭据）'),
  zhipuCredentialRef: z.string().default('ZAI_CODING_CN_API_KEY').description('自动模式的智谱凭据引用名'),
  zhipuType: z.number().default(2).description('套餐类型：1=个人，2=团队'),
  zhipuOrganization: z.string().default('').description('bigmodel-organization 请求头，如 org-xxxx'),
  zhipuProject: z.string().default('').description('bigmodel-project 请求头，如 proj-xxxx'),
  zhipuEndpoint: z.string().default('https://open.bigmodel.cn').description('智谱站点地址'),
  deepseekEnabled: z.boolean().default(true).description('启用 DeepSeek 余额'),
  deepseekApiKey: z.string().default('').description('手动填写的 DeepSeek API Key（留空则自动复用 DSH 已配置的 DeepSeek 凭据）'),
  deepseekCredentialRef: z.string().default('DEEPSEEK_API_KEY').description('自动模式的凭据引用名'),
  refreshMinutes: z.number().default(5).description('后台刷新间隔（分钟）'),
  warnRemainingPct: z.number().default(20).description('剩余百分比低于该值时进度条转警示色'),
});

const ZHIPU_WINDOW_KINDS = { 3: 'hours', 6: 'week' };

function emptyState() {
  return {
    zhipu: { configured: false, windows: [], error: null },
    deepseek: { configured: false, balances: [], error: null },
    fetchedAt: null,
  };
}

export function apply(ctx, config) {
  const state = emptyState();
  let inflight = null;
  let lastAttempt = 0;

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

  async function resolveZhipuKey() {
    if (config.zhipuApiKey) return config.zhipuApiKey;
    try {
      const resolved = await ctx.credentials.resolve(config.zhipuCredentialRef || 'ZAI_CODING_CN_API_KEY');
      if (resolved?.value) return resolved.value;
    } catch {}
    try {
      const records = await ctx.credentials.listRecords();
      for (const entry of records) {
        if (!/zai|zhipu|bigmodel|glm/i.test(String(entry.key))) continue;
        if (entry.kind !== 'api-key') continue;
        const record = await ctx.credentials.readRecord(entry.key);
        if (record?.kind === 'api-key' && record.key) return record.key;
      }
    } catch {}
    return null;
  }

  async function refreshZhipu() {
    if (!config.zhipuEnabled) {
      state.zhipu = { configured: false, windows: [], error: null };
      return;
    }
    const key = await resolveZhipuKey();
    if (!key) {
      state.zhipu = { configured: false, windows: [], error: null };
      return;
    }
    state.zhipu.configured = true;
    const headers = {
      Authorization: key,
      'User-Agent': 'Mozilla/5.0 (DSH usage plugin)',
    };
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

  async function resolveDeepSeekKey() {
    if (config.deepseekApiKey) return config.deepseekApiKey;
    try {
      const resolved = await ctx.credentials.resolve(config.deepseekCredentialRef || 'DEEPSEEK_API_KEY');
      if (resolved?.value) return resolved.value;
    } catch {}
    try {
      const records = await ctx.credentials.listRecords();
      for (const entry of records) {
        if (!/deepseek/i.test(String(entry.key))) continue;
        if (entry.kind !== 'api-key') continue;
        const record = await ctx.credentials.readRecord(entry.key);
        if (record?.kind === 'api-key' && record.key) return record.key;
      }
    } catch {}
    return null;
  }

  async function refreshDeepSeek() {
    if (!config.deepseekEnabled) {
      state.deepseek = { configured: false, balances: [], error: null };
      return;
    }
    const key = await resolveDeepSeekKey();
    if (!key) {
      state.deepseek = { configured: false, balances: [], error: null };
      return;
    }
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

  async function refresh(force = false) {
    const now = Date.now();
    if (!force && inflight) return inflight;
    if (!force && now - lastAttempt < 60000) return null;
    lastAttempt = now;
    const tasks = [];
    tasks.push(refreshZhipu().catch((error) => {
      state.zhipu.error = String(error?.message || error);
    }));
    tasks.push(refreshDeepSeek().catch((error) => {
      state.deepseek.error = String(error?.message || error);
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
        ...state,
        zhipu: { ...state.zhipu },
        deepseek: { ...state.deepseek },
        thresholds: { warnRemainingPct: config.warnRemainingPct },
      }));
    },
  }), 'dsh-usage: quota route');
}
