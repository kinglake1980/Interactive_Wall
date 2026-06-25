// 切片5 测试：观众页网址推导
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { audienceUrlFromOrigin } = await import('../web/src/lib/url.js');

test('在源地址后补根路径', () => {
  assert.equal(audienceUrlFromOrigin('http://192.168.1.5:5173'), 'http://192.168.1.5:5173/');
  assert.equal(audienceUrlFromOrigin('http://localhost:5173'), 'http://localhost:5173/');
});

test('已带结尾斜杠时不重复', () => {
  assert.equal(audienceUrlFromOrigin('http://example.com/'), 'http://example.com/');
  assert.equal(audienceUrlFromOrigin('http://example.com///'), 'http://example.com/');
});
