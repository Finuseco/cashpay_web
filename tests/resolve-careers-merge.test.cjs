'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const script = path.resolve(__dirname, '../scripts/resolve-careers-merge.sh');
const files = ['src/lib/careers/handler.js', 'src/lib/careers/mailer.js', 'src/lib/careers/templates.js', 'tests/careers.test.js'];
const originUrl = 'git@github.com:Finuseco/cashpay_web.git';

function command(cwd, bin, args, options = {}) {
  const r = spawnSync(bin, args, { cwd, encoding: 'utf8', ...options });
  if (r.status !== 0) throw new Error(`${bin} ${args.join(' ')}: ${r.stdout}\n${r.stderr}`);
  return r.stdout.trim();
}
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'careers-merge-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'source'), wallet = path.join(root, 'wallet'), remote = path.join(root, 'remote.git'), bin = path.join(root, 'bin');
  fs.mkdirSync(source); fs.mkdirSync(bin);
  const git = (cwd, ...args) => command(cwd, 'git', args);
  const write = (cwd, file, value) => { const p = path.join(cwd, file); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, value); };
  const configure = cwd => { git(cwd, 'config', 'user.name', 'Fixture'); git(cwd, 'config', 'user.email', 'fixture@example.test'); git(cwd, 'config', 'commit.gpgsign', 'false'); };
  git(source, 'init', '-b', 'main'); configure(source);
  write(source, 'README.md', 'shared base\n'); git(source, 'add', 'README.md'); git(source, 'commit', '-m', 'base');
  const base = git(source, 'rev-parse', 'HEAD');
  for (const file of files) write(source, file, `module.exports = ${JSON.stringify('prior ' + file)};\n`);
  git(source, 'add', ...files); git(source, 'commit', '-m', 'independent remote additions');
  for (const file of files) write(source, file, `module.exports = ${JSON.stringify('incoming ' + file)};\n`);
  write(source, 'src/lib/careers/assets.js', 'module.exports = { logos: {} };\n');
  git(source, 'add', ...files, 'src/lib/careers/assets.js'); git(source, 'commit', '-m', 'CID mail design');
  const incoming = git(source, 'rev-parse', 'HEAD');
  for (const file of files) write(source, file, `module.exports = ${JSON.stringify('latest ' + file)};\n`);
  write(source, 'remote-added.txt', 'latest remote update\n'); git(source, 'add', ...files, 'remote-added.txt'); git(source, 'commit', '-m', 'latest remote updates');
  const target = git(source, 'rev-parse', 'HEAD');
  git(root, 'clone', '--bare', source, remote); git(root, 'clone', remote, wallet); configure(wallet);
  git(wallet, 'checkout', '-B', 'main', base);
  for (const file of files) write(wallet, file, `module.exports = ${JSON.stringify('prior ' + file)};\n`);
  git(wallet, 'add', ...files); git(wallet, 'commit', '-m', 'independent local additions');
  for (let i = 0; i < 44; i++) git(wallet, 'commit', '--allow-empty', '-m', `local update ${i}`);
  const before = git(wallet, 'rev-parse', 'HEAD');
  const merge = spawnSync('git', ['merge', '--no-edit', incoming], { cwd: wallet, encoding: 'utf8' });
  assert.notEqual(merge.status, 0); assert.equal(git(wallet, 'rev-parse', 'MERGE_HEAD'), incoming);
  assert.equal(git(wallet, 'rev-list', '--count', before, '--not', target), '45');
  git(wallet, 'config', 'remote.origin.url', originUrl);
  git(wallet, 'config', `url.${remote}.insteadOf`, originUrl);
  write(wallet, 'public/images/videos/private.mp4', 'uploaded user media');
  write(wallet, '.env', 'SYNTHETIC_LOCAL_CONFIG=preserved\n');
  const nodeLog = path.join(root, 'node.log');
  write(root, 'bin/node', '#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$FAKE_NODE_LOG"\nif [ "${FAKE_NODE_FAIL:-0}" = 1 ]; then exit 17; fi\n');
  fs.chmodSync(path.join(bin, 'node'), 0o755);
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_NODE_LOG: nodeLog, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' };
  const run = extra => spawnSync('bash', [script], { cwd: wallet, env: { ...env, ...extra }, encoding: 'utf8', timeout: 30000 });
  return { root, wallet, source, target, before, incoming, nodeLog, git: (...args) => git(wallet, ...args), run,
    index: () => fs.readFileSync(path.join(wallet, '.git/index')),
    currentFiles: () => files.map(file => fs.readFileSync(path.join(wallet, file))),
    write: (file, value) => write(wallet, file, value) };
}

test('targeted resolution preserves all 45 local commits, merges fetched main and keeps uploads/env untracked', t => {
  const f = fixture(t); const result = f.run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(command(f.wallet, 'git', ['merge-base', '--is-ancestor', f.before, 'HEAD']), '');
  assert.equal(command(f.wallet, 'git', ['merge-base', '--is-ancestor', f.target, 'HEAD']), '');
  for (const file of files) assert.equal(fs.readFileSync(path.join(f.wallet, file), 'utf8'), f.git('show', `${f.target}:${file}`) + '\n');
  assert.equal(fs.readFileSync(path.join(f.wallet, 'public/images/videos/private.mp4'), 'utf8'), 'uploaded user media');
  assert.equal(fs.readFileSync(path.join(f.wallet, '.env'), 'utf8'), 'SYNTHETIC_LOCAL_CONFIG=preserved\n');
  assert.equal(f.git('ls-files', '.env', 'public/images/videos/private.mp4'), '');
  assert.equal(f.git('diff', '--name-only', '--diff-filter=U'), '');
  const backups = f.git('branch', '--list', 'backup/careers-before-merge-*'); assert.ok(backups.includes('backup/careers-before-merge-'));
  const backupRoot = path.join(f.wallet, '.git/cashpay-merge-backups'); const saved = path.join(backupRoot, fs.readdirSync(backupRoot)[0]);
  assert.equal(fs.statSync(saved).mode & 0o777, 0o700);
  assert.ok(fs.readFileSync(path.join(saved, 'worktree', files[0]), 'utf8').includes('<<<<<<<'));
  assert.ok(fs.readFileSync(path.join(saved, 'ours', files[0]), 'utf8').includes('prior'));
  assert.ok(fs.readFileSync(path.join(saved, 'theirs', files[0]), 'utf8').includes('incoming'));
  assert.equal(fs.readFileSync(f.nodeLog, 'utf8').trim().split('\n').length, 5);
});

test('failed source validation restores the original index/conflicted worktree and leaves the ongoing merge intact', t => {
  const f = fixture(t), index = f.index(), originals = f.currentFiles(); const result = f.run({ FAKE_NODE_FAIL: '1' });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /restaurés/);
  assert.equal(f.git('rev-parse', 'HEAD'), f.before); assert.equal(f.git('rev-parse', 'MERGE_HEAD'), f.incoming);
  assert.deepEqual(f.index(), index); assert.deepEqual(f.currentFiles(), originals);
  assert.equal(fs.readFileSync(path.join(f.wallet, 'public/images/videos/private.mp4'), 'utf8'), 'uploaded user media');
});

test('unrelated staged files are refused before any source or index changes', t => {
  const f = fixture(t); f.write('unrelated.txt', 'do not commit this'); f.git('add', 'unrelated.txt');
  const index = f.index(), originals = f.currentFiles(); const result = f.run();
  assert.notEqual(result.status, 0); assert.match(result.stderr, /autre fichier est déjà indexé/);
  assert.deepEqual(f.index(), index); assert.deepEqual(f.currentFiles(), originals); assert.equal(f.git('rev-parse', 'HEAD'), f.before);
});

test('a different repository origin is refused without fetching or changing the merge', t => {
  const f = fixture(t); f.git('config', 'remote.origin.url', 'git@github.com:Finuseco/News.git');
  const index = f.index(), originals = f.currentFiles(); const result = f.run();
  assert.notEqual(result.status, 0); assert.match(result.stderr, /dépôt origin doit être Finuseco\/cashpay_web/);
  assert.deepEqual(f.index(), index); assert.deepEqual(f.currentFiles(), originals);
});

test('a mixed local CID asset version is refused rather than overwritten', t => {
  const f = fixture(t); f.write('src/lib/careers/assets.js', 'module.exports = { custom: true };\n');
  const index = f.index(), originals = f.currentFiles(); const result = f.run();
  assert.notEqual(result.status, 0); assert.match(result.stderr, /logos locaux diffèrent/);
  assert.deepEqual(f.index(), index); assert.deepEqual(f.currentFiles(), originals);
});

test('a failed commit restores the pre-resolution index and files after targeted git add', t => {
  const f = fixture(t); const hook = path.join(f.wallet, '.git/hooks/pre-commit');
  fs.writeFileSync(hook, '#!/usr/bin/env bash\nexit 19\n'); fs.chmodSync(hook, 0o755);
  const index = f.index(), originals = f.currentFiles(); const result = f.run();
  assert.notEqual(result.status, 0); assert.match(result.stderr, /restaurés/);
  assert.equal(f.git('rev-parse', 'HEAD'), f.before); assert.equal(f.git('rev-parse', 'MERGE_HEAD'), f.incoming);
  assert.deepEqual(f.index(), index); assert.deepEqual(f.currentFiles(), originals);
});

test('an ongoing merge outside fetched main ancestry is refused without touching the worktree', t => {
  const f = fixture(t); fs.writeFileSync(path.join(f.wallet, '.git/MERGE_HEAD'), f.before + '\n');
  const index = f.index(), originals = f.currentFiles(); const result = f.run();
  assert.notEqual(result.status, 0); assert.match(result.stderr, /ne vient pas de cet historique/);
  assert.deepEqual(f.index(), index); assert.deepEqual(f.currentFiles(), originals);
});
