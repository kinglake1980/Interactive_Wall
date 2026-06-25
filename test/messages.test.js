// 切片2 测试：留言逻辑（用临时数据库，不碰开发数据）
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDb = path.join(os.tmpdir(), `wall-msg-test-${Date.now()}.db`);
process.env.DB_PATH = tmpDb;

const { createMessage, getMessagesAfter, MESSAGE_MAX_LEN } = await import(
  '../server/messages.js'
);

test('createMessage 存一条留言并能读回来', () => {
  const r = createMessage('你好');
  assert.equal(r.ok, true);
  const { messages, maxId } = getMessagesAfter(0);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].content, '你好');
  assert.equal(maxId, r.id);
});

test('空白留言被拒绝', () => {
  assert.equal(createMessage('   ').ok, false);
  assert.equal(createMessage('').ok, false);
});

test('超过 50 字的留言被拒绝', () => {
  const longText = '字'.repeat(MESSAGE_MAX_LEN + 1);
  assert.equal(createMessage(longText).ok, false);
  assert.equal(createMessage('字'.repeat(MESSAGE_MAX_LEN)).ok, true);
});

test('getMessagesAfter 只返回 id 更大的留言（增量拉取）', () => {
  const a = createMessage('第一条');
  const b = createMessage('第二条');
  const { messages } = getMessagesAfter(a.id);
  assert.ok(messages.every((m) => m.id > a.id));
  assert.ok(messages.some((m) => m.id === b.id));
  assert.ok(!messages.some((m) => m.id === a.id));
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
