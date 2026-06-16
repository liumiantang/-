import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getAiConfig, updateAiConfig, testAiConnection } from '../api';
import type { AiConfig } from '../types';

const PROVIDERS = [
  { id: 'deepseek', name: 'DeepSeek', desc: '国产性价比之王' },
  { id: 'openai', name: 'OpenAI', desc: 'GPT-4o 系列' },
  { id: 'qwen', name: '通义千问', desc: '阿里云大模型' },
  { id: 'ollama', name: 'Ollama', desc: '本地运行' },
  { id: 'custom', name: '自定义', desc: '任意兼容 API' },
];

export default function AiSettingsPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [provider, setProvider] = useState('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [apiBase, setApiBase] = useState('');
  const [model, setModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [maskKey, setMaskKey] = useState(true);

  useEffect(() => {
    getAiConfig().then(c => {
      setConfig(c);
      setProvider(c.provider);
      setApiBase(c.api_base);
      setModel(c.model);
    }).catch(err => console.error('Failed to load AI config:', err));
  }, []);

  const handleProviderChange = (p: string) => {
    setProvider(p);
    if (config?.presets?.[p]) {
      setApiBase(config.presets[p].api_base);
      setModel(config.presets[p].model);
    }
    setTestResult(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data: Record<string, string> = { provider, api_base: apiBase, model };
      if (apiKey) data.api_key = apiKey;
      await updateAiConfig(data);
      setApiKey('');
      alert('保存成功');
    } catch (err) { console.error('Failed to save AI config:', err); alert('保存失败'); }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Save config first if apiKey changed
      if (apiKey) {
        await updateAiConfig({ provider, api_key: apiKey, api_base: apiBase, model });
        setApiKey('');
      }
      const res = await testAiConnection();
      setTestResult({ ok: res.ok, msg: res.ok ? `✅ 连接成功！回复: ${res.reply}` : `❌ ${res.error}` });
    } catch (err: any) {
      setTestResult({ ok: false, msg: `❌ ${err.response?.data?.detail || err.message}` });
    }
    setTesting(false);
  };

  return (
    <div>
      <button onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '14px', padding: 0, marginBottom: '16px', display: 'block' }}>
        ← 返回
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: 0 }}>⚙️ AI 配置</h1>
        <Link to="/ai/usage" style={{ fontSize: '13px', color: '#f59e0b', fontWeight: 600, textDecoration: 'none' }}>
          💰 Token 用量 →
        </Link>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
        支持所有 OpenAI 兼容 API（DeepSeek / OpenAI / 通义千问 / Ollama 等）
      </p>

      <div className="card" style={{ padding: '20px', maxWidth: '560px' }}>
        {/* Provider */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>服务商</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {PROVIDERS.map(p => (
              <button key={p.id}
                onClick={() => handleProviderChange(p.id)}
                title={p.desc}
                style={{
                  padding: '6px 14px', fontSize: '13px', borderRadius: 'var(--radius-sm)',
                  border: provider === p.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: provider === p.id ? 'var(--accent-light)' : 'var(--bg-input)',
                  color: provider === p.id ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: provider === p.id ? 600 : 400,
                  cursor: 'pointer',
                }}
              >{p.name}</button>
            ))}
          </div>
        </div>

        {/* API Key */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
            API Key {config?.has_key && <span style={{ color: '#16a34a', fontWeight: 400 }}>(已配置)</span>}
          </label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type={maskKey ? 'password' : 'text'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={config?.has_key ? '留空则保留原 Key' : '输入 API Key'}
              style={{ flex: 1, padding: '8px 10px', fontSize: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
            />
            <button onClick={() => setMaskKey(!maskKey)}
              style={{ padding: '6px 10px', fontSize: '18px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', cursor: 'pointer' }}
            >{maskKey ? '👁️' : '🙈'}</button>
          </div>
        </div>

        {/* API Base */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>API 地址</label>
          <input value={apiBase} onChange={e => setApiBase(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', fontSize: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
          />
        </div>

        {/* Model */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>模型</label>
          <input value={model} onChange={e => setModel(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', fontSize: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
            {saving ? '保存中...' : '💾 保存'}
          </button>
          <button onClick={handleTest} disabled={testing} className="btn btn-outline" style={{ flex: 1 }}>
            {testing ? '测试中...' : '🔍 测试连接'}
          </button>
        </div>

        {/* Test result */}
        {testResult && (
          <div style={{
            marginTop: '14px', padding: '10px 14px', borderRadius: 'var(--radius-sm)',
            background: testResult.ok ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${testResult.ok ? '#bbf7d0' : '#fecaca'}`,
            color: testResult.ok ? '#166534' : '#dc2626',
            fontSize: '13px',
          }}>
            {testResult.msg}
          </div>
        )}
      </div>

      {/* Provider info card */}
      <div className="card" style={{ padding: '16px', maxWidth: '560px', marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>💡 各服务商说明</div>
        <div>• <b>DeepSeek</b>：国产性价比最高，需在 platform.deepseek.com 获取 Key</div>
        <div>• <b>OpenAI</b>：GPT-4o-mini 便宜好用，需在 platform.openai.com 获取 Key</div>
        <div>• <b>通义千问</b>：阿里云百炼平台获取 Key，免费额度充足</div>
        <div>• <b>Ollama</b>：安装 Ollama 后本地运行，无需 Key，免费无限制</div>
        <div>• <b>自定义</b>：任意 OpenAI 兼容 API，填你自己的地址</div>
      </div>
    </div>
  );
}
