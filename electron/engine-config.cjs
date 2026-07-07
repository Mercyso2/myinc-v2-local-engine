const fs = require('node:fs');
const path = require('node:path');

const EDITABLE_KEYS = [
  'OPENAI_API_KEY',
  'OPENAI_TEXT_MODEL',
  'OPENAI_IMAGE_MODEL',
  'OPENAI_IMAGE_QUALITY',
  'OPENAI_IMAGE_FORMAT',
  'OPENAI_MAX_REFERENCE_IMAGES',
  'CREATIVE_COST_MODE',
  'CREATIVE_FINAL_RENDER',
  'OPENAI_VIDEO_ENABLED',
  'OPENAI_VIDEO_MODEL',
  'OPENAI_VIDEO_SECONDS',
  'OPENAI_VIDEO_SIZE',
  'ENGINE_WORKER_NAME',
  'ENGINE_POLL_INTERVAL_MS',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_WORKER_DEVICE_KEY',
];

const SENSITIVE_KEYS = new Set(['OPENAI_API_KEY', 'SUPABASE_WORKER_DEVICE_KEY', 'SUPABASE_ANON_KEY']);

function parseEnvText(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    values[key] = value;
  }
  return values;
}

function readEngineConfig(envPath) {
  const values = fs.existsSync(envPath) ? parseEnvText(fs.readFileSync(envPath, 'utf8')) : {};
  const config = {};
  for (const key of EDITABLE_KEYS) {
    const raw = values[key] ?? '';
    config[key] = {
      value: SENSITIVE_KEYS.has(key) ? '' : raw,
      configured: Boolean(raw),
    };
  }
  return config;
}

// Só sobrescreve as chaves enviadas; mantém o restante do arquivo intacto
// (inclusive comentários e chaves não editáveis por aqui).
function writeEngineConfig(envPath, patch) {
  const existingText = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const lines = existingText ? existingText.split(/\r?\n/) : [];
  const seen = new Set();
  const nextLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) return line;
    const key = trimmed.slice(0, idx).trim();
    if (!Object.prototype.hasOwnProperty.call(patch, key)) return line;
    seen.add(key);
    const value = patch[key];
    if (value === '' || value === undefined || value === null) return line;
    return `${key}=${value}`;
  });
  for (const [key, value] of Object.entries(patch)) {
    if (seen.has(key)) continue;
    if (value === '' || value === undefined || value === null) continue;
    nextLines.push(`${key}=${value}`);
  }
  fs.mkdirSync(path.dirname(envPath), { recursive: true });
  fs.writeFileSync(envPath, nextLines.join('\n').replace(/\n{3,}/g, '\n\n'));
}

module.exports = { EDITABLE_KEYS, SENSITIVE_KEYS, readEngineConfig, writeEngineConfig };
