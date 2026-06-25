// 切片2：留言（弹幕）核心逻辑，与 HTTP 层解耦，方便测试
// 切片3：入库前经敏感词过滤
import db from './db.js';
import { filterText, FILTER_MODE } from './filter.js';

export const MESSAGE_MAX_LEN = 50;

// 新建一条留言：命中敏感词时按 FILTER_MODE 打码或拦截
export function createMessage(content) {
  const text = (content ?? '').toString().trim();
  if (!text) return { ok: false, error: '留言不能为空' };
  if (text.length > MESSAGE_MAX_LEN) {
    return { ok: false, error: `留言不能超过 ${MESSAGE_MAX_LEN} 字` };
  }

  const { masked, hit } = filterText(text);
  if (hit && FILTER_MODE === 'block') {
    return { ok: false, error: '留言包含敏感词' };
  }

  // 命中则把打码版存进 masked_content；大屏展示用打码版
  const info = db
    .prepare("INSERT INTO messages (content, masked_content, status) VALUES (?, ?, 'visible')")
    .run(text, hit ? masked : null);
  return { ok: true, id: Number(info.lastInsertRowid), content: hit ? masked : text };
}

// 取 id 大于 afterId 的可见留言（供大屏增量拉取），并返回当前最大 id
export function getMessagesAfter(afterId = 0, limit = 100) {
  const messages = db
    .prepare(
      `SELECT id, COALESCE(masked_content, content) AS content, created_at
         FROM messages
        WHERE status = 'visible' AND id > ?
        ORDER BY id ASC
        LIMIT ?`
    )
    .all(Number(afterId) || 0, limit);
  const maxId = db
    .prepare("SELECT COALESCE(MAX(id), 0) AS m FROM messages WHERE status = 'visible'")
    .get().m;
  return { messages, maxId };
}
