const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

let child = null;
let lastBaseDir = null;

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function engineCandidates(baseDir) {
  const resources = process.resourcesPath || '';
  return unique([
    path.join(resources, 'app.asar.unpacked', 'engine', 'runtime', 'main-loop.mjs'),
    path.join(resources, 'app', 'engine', 'runtime', 'main-loop.mjs'),
    path.join(baseDir || '', 'engine', 'runtime', 'main-loop.mjs'),
    path.join(process.cwd(), 'engine', 'runtime', 'main-loop.mjs'),
  ]);
}

function engineScript(baseDir) {
  const script = engineCandidates(baseDir).find((item) => fs.existsSync(item));
  if (!script) {
    throw new Error(`Motor local não encontrado. Caminhos testados:\n${engineCandidates(baseDir).join('\n')}`);
  }
  return script;
}

function engineCwd(baseDir) {
  const exeDir = path.dirname(process.execPath || process.cwd());
  const candidates = unique([
    process.env.MYINC_ENGINE_CWD,
    process.cwd(),
    exeDir,
    baseDir,
    path.dirname(path.dirname(engineScript(baseDir))),
  ]);
  return candidates.find((item) => item && fs.existsSync(path.join(item, '.env.engine'))) || candidates.find((item) => item && fs.existsSync(item)) || process.cwd();
}

function startEngine(baseDir) {
  lastBaseDir = baseDir || lastBaseDir || process.cwd();
  if (child && !child.killed) return child;
  const script = engineScript(lastBaseDir);
  const cwd = engineCwd(lastBaseDir);
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    MYINC_ENGINE_ROOT: lastBaseDir,
    MYINC_ENGINE_CWD: cwd,
  };
  child = spawn(process.execPath, [script], { stdio: 'inherit', env, cwd });
  child.on('exit', (code) => {
    console.log('MYINC engine saiu:', code);
    child = null;
  });
  child.on('error', (error) => {
    console.error('Falha ao iniciar MYINC engine:', error.message);
    child = null;
  });
  return child;
}

function stopEngine() {
  if (child && !child.killed) child.kill();
  child = null;
}

function isRunning() {
  return Boolean(child && !child.killed);
}

function restartEngine(baseDir) {
  stopEngine();
  return startEngine(baseDir || lastBaseDir);
}

function envFilePath(baseDir) {
  return path.join(engineCwd(baseDir || lastBaseDir), '.env.engine');
}

module.exports = {
  startEngine,
  stopEngine,
  restartEngine,
  isRunning,
  engineScript,
  engineCwd,
  envFilePath,
};
