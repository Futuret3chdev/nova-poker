#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const ROOT = __dirname;
const OWNER = process.env.GITHUB_OWNER || 'Futuret3chdev';
const REPO = process.env.GITHUB_REPO || 'nova-poker';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const MESSAGE = process.argv[2] || `Update ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
// GitHub → Vercel auto-deploy is not wired for nova-poker; CLI deploy is the default.
const USE_VERCEL_CLI = process.env.SYNC_VERCEL !== 'skip';

const SKIP = new Set(['.git', '.vercel', '.tools', 'node_modules', '.DS_Store']);
const BINARY_EXT = /\.(png|jpg|jpeg|gif|ico|webp|glb|mp4)$/i;

function getGhToken() {
  for (const envPath of [
    path.join(ROOT, '.env.local'),
    path.join(ROOT, '../starfeet/.env.local'),
    path.join(ROOT, '../metro-vice/.env.local')
  ]) {
    try {
      const m = fs.readFileSync(envPath, 'utf8').match(/GITHUB_TOKEN=(.+)/);
      if (m) return m[1].trim();
    } catch (_) {}
  }
  const ghPaths = [
    path.join(ROOT, '../mte-pop/.tools/gh'),
    path.join(ROOT, '../metro-vice/.tools/gh'),
    path.join(ROOT, '.tools/gh'),
    'gh'
  ];
  for (const gh of ghPaths) {
    try {
      return execSync(`"${gh}" auth token`, { encoding: 'utf8' }).trim();
    } catch (_) {}
  }
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  throw new Error('GitHub not authenticated');
}

function api(token, method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path: apiPath,
      method,
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'nova-poker-sync',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function walk(dir, base = '') {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...walk(path.join(dir, entry.name), rel));
    else files.push(rel);
  }
  return files;
}

async function createBlob(token, filePath) {
  const full = path.join(ROOT, filePath);
  const buf = fs.readFileSync(full);
  const body = BINARY_EXT.test(filePath)
    ? { content: buf.toString('base64'), encoding: 'base64' }
    : { content: buf.toString('utf8'), encoding: 'utf-8' };
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await api(token, 'POST', `/repos/${OWNER}/${REPO}/git/blobs`, body);
    if (res.status === 201) return res.data.sha;
    if (res.status === 409 && attempt < 4) {
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      continue;
    }
    throw new Error(`Blob failed for ${filePath}: ${res.status}`);
  }
}

async function ensureRepo(token) {
  const check = await api(token, 'GET', `/repos/${OWNER}/${REPO}`);
  if (check.status !== 200) {
    const create = await api(token, 'POST', '/user/repos', {
      name: REPO,
      description: 'Nova Poker — Texas Hold\'em like PokerStars',
      private: false,
      auto_init: true
    });
    if (create.status !== 201) throw new Error(`Create repo failed: ${create.status}`);
    console.log(`📁 Created repo ${OWNER}/${REPO}`);
    await new Promise((r) => setTimeout(r, 2000));
    return;
  }
  const ref = await api(token, 'GET', `/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
  if (ref.status === 409) {
    await api(token, 'PUT', `/repos/${OWNER}/${REPO}/contents/README.md`, {
      message: 'Initialize Nova Poker',
      content: Buffer.from('# Nova Poker\n\nTexas Hold\'em poker game.\n').toString('base64')
    });
    console.log('📁 Initialized empty repo with README');
    await new Promise((r) => setTimeout(r, 1500));
  }
}

(async () => {
  console.log(`🚀 Nova Poker Sync — "${MESSAGE}"`);
  const token = getGhToken();
  await ensureRepo(token);
  const files = walk(ROOT).sort();
  console.log(`\n📦 GitHub: ${files.length} files → ${OWNER}/${REPO}`);
  const treeItems = [];
  for (const filePath of files) {
    const sha = await createBlob(token, filePath);
    treeItems.push({ path: filePath, mode: '100644', type: 'blob', sha });
    process.stdout.write(`  ✓ ${filePath}\n`);
  }
  const treeRes = await api(token, 'POST', `/repos/${OWNER}/${REPO}/git/trees`, { tree: treeItems });
  const refRes = await api(token, 'GET', `/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
  const parents = refRes.status === 200 ? [refRes.data.object.sha] : [];
  const commitRes = await api(token, 'POST', `/repos/${OWNER}/${REPO}/git/commits`, {
    message: MESSAGE, tree: treeRes.data.sha, parents
  });
  const commitSha = commitRes.data.sha;
  if (refRes.status === 200) {
    await api(token, 'PATCH', `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, { sha: commitSha });
  } else {
    await api(token, 'POST', `/repos/${OWNER}/${REPO}/git/refs`, { ref: `refs/heads/${BRANCH}`, sha: commitSha });
  }
  console.log(`✅ Pushed ${commitSha.slice(0, 7)} — https://github.com/${OWNER}/${REPO}`);

  if (USE_VERCEL_CLI) {
    const nodeBin = process.env.NODE_BIN || '/tmp/node-v22.16.0-darwin-x64/bin';
    const env = { ...process.env, PATH: `${nodeBin}:${process.env.PATH || ''}` };
    console.log('\n🚀 Vercel CLI: deploying to production...');
    execSync('npx vercel@latest --prod --yes', { cwd: ROOT, env, stdio: 'inherit' });
    console.log('✅ Vercel live: https://poker-stars-wheat.vercel.app');
  } else {
    console.log('\n💡 Vercel CLI skipped (SYNC_VERCEL=skip)');
  }
})();