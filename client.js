window.__ModuleLoader__.load({
  id: '@local/dsh-usage',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'dsh-usage';
    const PANEL_ID = 'dsh-usage';

    const zh = {
      panel: '用量统计',
      title: '用量统计',
      refresh: '刷新',
      refreshedJustNow: '刚刚更新',
      minutesAgoSuffix: ' 分钟前更新',
      loadFailed: '加载失败',
      retry: '重试',
      zhipu: '智谱 Code Plan',
      zhipuHoursPrefix: '',
      zhipuHoursSuffix: ' 小时剩余',
      zhipuWeek: '每周剩余',
      zhipuNotConfigured: '未配置：请在插件设置中填写 API Key 与组织/项目 ID',
      zhipuCreditsPrefix: '剩余 ',
      deepseek: 'DeepSeek 余额',
      deepseekNotConfigured: '未检测到已配置的 DeepSeek 凭据',
      granted: '赠送',
      toppedUp: '充值',
      resetAt: '重置',
      noData: '暂无数据',
      close: '关闭',
      settings: '设置',
    };
    const en = {
      panel: 'Usage',
      title: 'Usage',
      refresh: 'Refresh',
      refreshedJustNow: 'Updated just now',
      minutesAgoSuffix: 'm ago',
      loadFailed: 'Load failed',
      retry: 'Retry',
      zhipu: 'GLM Code Plan',
      zhipuHoursPrefix: '',
      zhipuHoursSuffix: 'h remaining',
      zhipuWeek: 'Weekly remaining',
      zhipuNotConfigured: 'Not configured: set the API key and organization/project ID in plugin settings',
      zhipuCreditsPrefix: 'credits left: ',
      deepseek: 'DeepSeek balance',
      deepseekNotConfigured: 'No configured DeepSeek credential found',
      granted: 'granted',
      toppedUp: 'topped up',
      resetAt: 'resets',
      noData: 'No data yet',
      close: 'Close',
      settings: 'Settings',
    };

    const CSS = `
.dshu-entry { box-sizing: border-box; border-radius: var(--dsw-radius-md); cursor: pointer; width: auto; min-width: 0;
  height: 30px; color: var(--dsw-alias-label-secondary); background: 0 0; border: none; flex: 1; align-items: center;
  gap: 7px; margin: 0; padding: 0 8px; font-family: inherit; font-size: 12px; line-height: 18px; display: flex; overflow: hidden; }
.dshu-entry:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.dshu-entry-label { white-space: nowrap; overflow: hidden; }
.dshu-overlay { z-index: 1000; justify-content: center; align-items: center; display: flex; position: fixed; inset: 0; }
.dshu-mask { position: absolute; inset: 0; background: var(--dsw-alias-bg-mask-1, var(--dsw-alias-bg-base)); backdrop-filter: var(--dsw-mask-blur); opacity: 0.9; }
.dshu-dialog { position: relative; z-index: 1; width: min(92vw, 620px); max-height: 80vh; overflow: auto; box-sizing: border-box;
  background: var(--dsw-specific-menu, var(--dsw-alias-bg-layer-1)); border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 14px; padding: 18px 18px 20px; }
.dshu-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.dshu-title { font-size: 15px; font-weight: 600; color: var(--dsw-alias-label-primary); margin: 0; }
.dshu-updated { font-size: 12px; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); }
.dshu-refresh { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); border-radius: var(--dsw-radius-md, 8px); padding: 6px 12px;
  font-size: 13px; cursor: pointer; min-height: 32px; font-family: inherit; }
.dshu-refresh:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.dshu-refresh:disabled { opacity: 0.6; cursor: default; }
.dshu-refresh.push { margin-left: auto; }
.dshu-close { border: 0; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer;
  border-radius: var(--dsw-radius-md, 8px); width: 32px; height: 32px; flex: none; display: inline-flex; align-items: center; justify-content: center; padding: 0; }
.dshu-close:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.dshu-launcher { align-items: center; gap: 6px; width: 100%; display: flex; }
.dshu-launcher.rail { flex-direction: column; gap: 10px; }
.dshu-launcher .dshu-entry { height: 42px; font-size: 14px; line-height: 22px; padding: 0 10px 0 8px; gap: 8px; }
.dshu-launcher.rail .dshu-entry { height: 36px; width: 36px; padding: 0; justify-content: center; }
.dshu-entry.dshu-usage-mini { flex: none; width: 32px; height: 32px; padding: 0; justify-content: center; color: var(--dsw-alias-label-secondary); }
.dshu-entry.dshu-usage-mini:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.dshu-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
.dshu-card { background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; padding: 16px; min-width: 0; }
.dshu-card-name { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--dsw-alias-label-secondary); margin-bottom: 10px; }
.dshu-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--dshu-level, var(--dsw-alias-state-idle-primary)); flex: none; }
.dshu-windows { display: flex; flex-direction: column; gap: 14px; }
.dshu-window-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.dshu-window-label { font-size: 13px; color: var(--dsw-alias-label-secondary); }
.dshu-pct { font-size: 24px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.dshu-reset { font-size: 12px; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); margin-left: auto; }
.dshu-bar { height: 6px; border-radius: 3px; background: var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-2)); overflow: hidden; margin-top: 8px; }
.dshu-bar-fill { height: 100%; border-radius: 3px; background: var(--dshu-level, var(--dsw-alias-state-idle-primary)); transition: width .3s ease; }
.dshu-credits { font-size: 12px; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); margin-top: 6px; }
.dshu-balance { font-size: 22px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.dshu-balance-sub { font-size: 12px; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); margin-top: 4px; }
.dshu-muted { font-size: 13px; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); }
.dshu-error { font-size: 12px; color: var(--dsw-alias-state-error-primary); margin-top: 8px; word-break: break-all; }
@media (max-width: 640px) {
  .dshu-dialog { width: 96vw; max-height: 85vh; }
  .dshu-grid { grid-template-columns: 1fr; }
  .dshu-pct { font-size: 22px; }
}
`;

    const popupStore = {
      open: false,
      listeners: new Set(),
      set(v) { this.open = v; this.listeners.forEach((f) => f()); },
    };
    function usePopupOpen() {
      const [open, setOpen] = React.useState(popupStore.open);
      React.useEffect(() => {
        const f = () => setOpen(popupStore.open);
        popupStore.listeners.add(f);
        return () => { popupStore.listeners.delete(f); };
      }, []);
      return open;
    }

    function levelVar(remainingPct, warnPct) {
      if (remainingPct == null) return undefined;
      if (remainingPct < warnPct) return 'var(--dsw-alias-state-error-primary)';
      if (remainingPct < 50) return 'var(--dsw-alias-state-warn-primary)';
      return 'var(--dsw-alias-state-success-primary)';
    }

    function UsageIcon(props) {
      const size = props?.size ?? 18;
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true, style: { display: 'block' },
      },
      h('path', { d: 'M21 12a9 9 0 1 0-9 9' }),
      h('path', { d: 'M12 12l5-3' }),
      h('circle', { cx: 12, cy: 12, r: 1.4, fill: 'currentColor', stroke: 'none' }),
      h('path', { d: 'M17 21a9 9 0 0 0 4-4' }),
      h('path', { d: 'M21 17.5v3.5h-3.5' }));
    }

    function Bar({ remainingPct, warnPct }) {
      const pct = remainingPct == null ? 0 : Math.max(0, Math.min(100, remainingPct));
      return h('div', { className: 'dshu-bar', style: { '--dshu-level': levelVar(remainingPct, warnPct) } },
        h('div', { className: 'dshu-fill dshu-bar-fill', style: { width: pct + '%' } }));
    }

    function formatReset(ms, localeTag) {
      if (!ms) return null;
      try {
        return new Intl.DateTimeFormat(localeTag || undefined, {
          month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
        }).format(new Date(ms));
      } catch {
        return new Date(ms).toLocaleString();
      }
    }

    function UsagePage({ onClose }) {
      const [data, setData] = React.useState(null);
      const [loading, setLoading] = React.useState(true);
      const [error, setError] = React.useState(null);
      const [tick, setTick] = React.useState(0);

      const load = React.useCallback(async (force) => {
        setLoading(true);
        try {
          const res = await fetch('/dsh-usage/quota' + (force ? '?refresh=1' : ''), { cache: 'no-store' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          setData(await res.json());
          setError(null);
        } catch (e) {
          setError(String(e?.message || e));
        } finally {
          setLoading(false);
        }
      }, []);

      React.useEffect(() => { void load(false); }, [load]);

      const t = ctxLocale().t;

      const updated = data?.fetchedAt ? Date.now() - data.fetchedAt : null;
      const updatedText = updated == null ? null
        : updated < 90000 ? t('refreshedJustNow')
        : Math.round(updated / 60000) + t('minutesAgoSuffix');
      const warnPct = data?.thresholds?.warnRemainingPct ?? 20;

      const zhipu = data?.zhipu;
      const deepseek = data?.deepseek;
      const minRemaining = zhipu?.windows?.length
        ? Math.min(...zhipu.windows.map((w) => w.remainingPct ?? 100)) : null;

      return h('div', { className: 'dshu-dialog-body' },
        h('style', null, CSS),
        h('div', { className: 'dshu-header' },
          h('h2', { className: 'dshu-title' }, t('title')),
          updatedText && h('span', { className: 'dshu-updated', key: tick }, updatedText),
          h('button', {
            className: 'dshu-refresh push', type: 'button', disabled: loading,
            onClick: () => { void load(true); },
          }, UsageIcon({ size: 14 }), t('refresh')),
          onClose && h('button', {
            className: 'dshu-close', type: 'button', 'aria-label': t('close'),
            onClick: onClose,
          }, CloseIcon())),
        error && data == null
          ? h('div', { className: 'dshu-card' },
              h('div', { className: 'dshu-muted' }, `${t('loadFailed')}: ${error}`),
              h('button', { className: 'dshu-refresh', type: 'button', style: { marginTop: 10 }, onClick: () => { void load(true); } }, t('retry')))
          : h('div', { className: 'dshu-grid' },

            h('div', { className: 'dshu-card', style: { '--dshu-level': levelVar(minRemaining, warnPct) } },
              h('div', { className: 'dshu-card-name' }, h('span', { className: 'dshu-dot' }), t('zhipu')),
              !zhipu?.configured
                ? h('div', { className: 'dshu-muted' }, t('zhipuNotConfigured'))
                : zhipu.windows.length
                  ? h('div', { className: 'dshu-windows' },
                      zhipu.windows.map((w, i) => h('div', { key: w.kind + i },
                        h('div', { className: 'dshu-window-head' },
                          h('span', { className: 'dshu-window-label' },
                            w.kind === 'hours' ? t('zhipuHoursPrefix') + (w.hours || 5) + t('zhipuHoursSuffix') : t('zhipuWeek')),
                          h('span', { className: 'dshu-pct' },
                            w.remainingPct == null ? t('noData') : Math.round(w.remainingPct) + '%'),
                          w.resetAt && h('span', { className: 'dshu-reset' }, `${t('resetAt')} ${formatReset(w.resetAt)}`)),
                        h(Bar, { remainingPct: w.remainingPct, warnPct }),
                        w.remainingCredits != null && w.totalCredits != null
                          && h('div', { className: 'dshu-credits' }, `${t('zhipuCreditsPrefix')}${w.remainingCredits} / ${w.totalCredits}`))),
                      zhipu.error && h('div', { className: 'dshu-error' }, zhipu.error))
                  : h('div', null,
                      h('div', { className: 'dshu-muted' }, t('noData')),
                      zhipu.error && h('div', { className: 'dshu-error' }, zhipu.error))),

            h('div', { className: 'dshu-card' },
              h('div', { className: 'dshu-card-name' },
                h('span', { className: 'dshu-dot', style: { '--dshu-level': deepseek?.error && !deepseek?.balances?.length
                  ? 'var(--dsw-alias-state-error-primary)'
                  : deepseek?.balances?.length ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-idle-primary)' } }),
                t('deepseek')),
              !deepseek?.configured
                ? h('div', { className: 'dshu-muted' }, t('deepseekNotConfigured'))
                : deepseek.balances.length
                  ? h('div', null,
                      deepseek.balances.map((b) => h('div', { key: b.currency, style: { marginBottom: 8 } },
                        h('div', { className: 'dshu-balance' }, `${b.total} ${b.currency}`),
                        (b.granted != null || b.toppedUp != null) && h('div', { className: 'dshu-balance-sub' },
                          [b.granted != null ? `${t('granted')} ${b.granted}` : null,
                           b.toppedUp != null ? `${t('toppedUp')} ${b.toppedUp}` : null].filter(Boolean).join(' · ')))))
                  : h('div', null,
                      h('div', { className: 'dshu-muted' }, t('noData')),
                      deepseek.error && h('div', { className: 'dshu-error' }, deepseek.error)),
              deepseek?.error && deepseek?.balances?.length && h('div', { className: 'dshu-error' }, deepseek.error))));
    }

    let localeHandle = null;
    function ctxLocale() {
      return localeHandle;
    }

    function GearIcon({ size }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true, style: { display: 'block', flex: 'none' },
      },
      h('circle', { cx: 12, cy: 12, r: 3 }),
      h('path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' }));
    }

    function LauncherRow(props) {
      const wide = props?.wide !== false;
      const openSettings = props?.openSettings;
      const usageButton = h('button', {
        className: 'dshu-entry dshu-usage-mini',
        type: 'button',
        'aria-label': localeHandle.t('panel'),
        'aria-haspopup': 'dialog',
        onClick: () => popupStore.set(true),
      }, UsageIcon({ size: wide ? 16 : 18 }));
      const settingsButton = h('button', {
        className: 'dshu-entry',
        type: 'button',
        'aria-label': localeHandle.t('settings'),
        onClick: () => { if (typeof openSettings === 'function') openSettings(); },
      },
      GearIcon({ size: wide ? 16 : 18 }),
      wide && h('span', { className: 'dshu-entry-label' }, localeHandle.t('settings')));
      return h('div', { className: 'dshu-launcher' + (wide ? '' : ' rail') },
        h('style', null, CSS),
        wide ? [settingsButton, usageButton] : [usageButton, settingsButton]);
    }

    function CloseIcon() {
      return h('svg', {
        width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        strokeWidth: 2, strokeLinecap: 'round', 'aria-hidden': true,
      }, h('path', { d: 'M6 6l12 12' }), h('path', { d: 'M18 6L6 18' }));
    }

    function UsagePopup() {
      const open = usePopupOpen();
      React.useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') popupStore.set(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [open]);
      if (!open) return null;
      return h('div', { className: 'dshu-overlay' },
        h('div', { className: 'dshu-mask', onClick: () => popupStore.set(false) }),
        h('div', { className: 'dshu-dialog', role: 'dialog', 'aria-label': localeHandle.t('panel') },
          h(UsagePage, { onClose: () => popupStore.set(false) })));
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-usage: dictionaries');
        localeHandle = { t: ctx.locale.bind(NS) };
        ctx.slots.inject('settings.launcher', () => ctx.slots.register({
          name: 'settings.launcher',
          locale: NS,
        }, LauncherRow));
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: PANEL_ID + '-popup',
          order: 50,
          locale: NS,
          label: () => localeHandle.t('panel'),
        }, UsagePopup));
      },
    };
  },
});
