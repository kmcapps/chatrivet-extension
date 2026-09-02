import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rootUrl = new URL('../', import.meta.url);

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, rootUrl), 'utf8'));
}

test('manifest exposes Japanese and English metadata without expanding permissions', async () => {
  const manifest = await readJson('manifest.json');
  const japanese = await readJson('_locales/ja/messages.json');
  const english = await readJson('_locales/en/messages.json');

  assert.equal(manifest.version, '1.3.1');
  assert.equal(manifest.default_locale, 'ja');
  assert.equal(manifest.name, '__MSG_extensionName__');
  assert.equal(manifest.description, '__MSG_extensionDescription__');
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.content_scripts.map(({ matches }) => matches), [['https://chatgpt.com/*']]);
  assert.equal('host_permissions' in manifest, false);
  assert.equal('background' in manifest, false);
  assert.equal('externally_connectable' in manifest, false);

  for (const messages of [japanese, english]) {
    assert.ok(messages.extensionName?.message);
    assert.ok(messages.extensionDescription?.message);
  }

  assert.equal(japanese.extensionName.message, 'ChatRivet');
  assert.equal(english.extensionName.message, 'ChatRivet');
  assert.equal(
    japanese.extensionDescription.message,
    'ChatGPTの左サイドバーに、ローカル保存の独自ピン一覧を追加する拡張機能。',
  );
  assert.ok(english.extensionDescription.message.length <= 132);

  const referencedKeys = [manifest.name, manifest.description].map((value) => {
    const match = /^__MSG_([A-Za-z0-9_]+)__$/.exec(value);
    assert.ok(match, `${value} must be a manifest message reference`);
    return match[1];
  });
  assert.deepEqual(Object.keys(japanese).sort(), Object.keys(english).sort());
  for (const key of referencedKeys) {
    assert.ok(japanese[key]?.message, `Japanese message ${key} must exist`);
    assert.ok(english[key]?.message, `English message ${key} must exist`);
  }
});

test('store listing keeps complete Japanese and English submission copy together', async () => {
  const listing = await readFile(new URL('STORE_LISTING.md', rootUrl), 'utf8');

  assert.match(listing, /## 日本語 Store Listing/);
  assert.match(listing, /## English Store Listing/);
  assert.match(listing, /### Name/);
  assert.match(listing, /### Short description/);
  assert.match(listing, /### Detailed description/);
  assert.match(listing, /Key features/);
  assert.match(listing, /### Privacy practices/);
  assert.match(listing, /#### Single purpose/);
  assert.match(listing, /#### Permission justification: storage/);
  assert.match(listing, /#### Host access justification: https:\/\/chatgpt\.com\/\*/);
  assert.match(listing, /## Test instructions/);
  assert.match(listing, /locally saved/i);
  assert.match(listing, /does not transmit/i);
  assert.match(listing, /Web history/);
  assert.match(listing, /Website content/);
  assert.match(listing, /User activity/);
});

test('store listing declares the three current screenshots as shared locale assets', async () => {
  const listing = await readFile(new URL('STORE_LISTING.md', rootUrl), 'utf8');
  const filenames = [
    'ChatRivet-v1.2.0-store-01-basic.png',
    'ChatRivet-v1.2.0-store-02-organize.png',
    'ChatRivet-v1.2.0-store-03-recent-coexist.png',
  ];

  for (const filename of filenames) assert.match(listing, new RegExp(filename));
  assert.match(listing, /shared.*Japanese.*English/i);
});
