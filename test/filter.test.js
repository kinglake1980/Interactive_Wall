// 切片3 测试：敏感词过滤（依赖 server/sensitive-words.txt 中的示例词"广告"）
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { filterText } = await import('../server/filter.js');

test('命中敏感词时打码，长度与原词一致', () => {
  const { masked, hit } = filterText('快来看广告啊');
  assert.equal(hit, true);
  assert.equal(masked, '快来看●●啊');
});

test('正常留言不受影响', () => {
  const { masked, hit } = filterText('今天天气不错');
  assert.equal(hit, false);
  assert.equal(masked, '今天天气不错');
});

// 集成：含敏感词的留言入库后，读回的是打码版而非原文
const tmpDb = path.join(os.tmpdir(), `wall-filter-test-${Date.now()}.db`);
process.env.DB_PATH = tmpDb;
const { createMessage, getMessagesAfter } = await import('../server/messages.js');

test('含敏感词的留言：存的与读回的都是打码版', () => {
  const r = createMessage('这是广告内容');
  assert.equal(r.ok, true);
  assert.ok(r.content.includes('●'));
  assert.ok(!r.content.includes('广告'));

  const { messages } = getMessagesAfter(0);
  const row = messages.find((m) => m.id === r.id);
  assert.ok(row.content.includes('●'));
  assert.ok(!row.content.includes('广告'));
});

test('正常留言照常入库、读回原文', () => {
  const r = createMessage('大家好');
  const { messages } = getMessagesAfter(0);
  const row = messages.find((m) => m.id === r.id);
  assert.equal(row.content, '大家好');
});

after(() => {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.rmSync(tmpDb + suffix);
    } catch {
      /* 忽略 */
    }
  }
});
