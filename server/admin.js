// 切片4：主持人后台的题目管理逻辑（与 HTTP 层解耦，方便测试）
import db from './db.js';

// 列出所有题目（含选项与各选项票数、是否为当前生效题目）
export function listQuestions() {
  const questions = db
    .prepare('SELECT id, text, is_active FROM questions ORDER BY id ASC')
    .all();
  const optStmt = db.prepare(
    `SELECT o.id, o.label,
            (SELECT COUNT(*) FROM votes v WHERE v.option_id = o.id) AS votes
       FROM options o WHERE o.question_id = ? ORDER BY o.position, o.id`
  );
  return questions.map((q) => ({
    id: q.id,
    text: q.text,
    is_active: !!q.is_active,
    options: optStmt.all(q.id),
  }));
}

// 校验题目文本与选项
function validate(text, options) {
  const t = (text ?? '').toString().trim();
  const opts = (options || [])
    .map((o) => (o ?? '').toString().trim())
    .filter(Boolean);
  if (!t) return { error: '题目不能为空' };
  if (opts.length < 2) return { error: '至少要有两个选项' };
  return { text: t, options: opts };
}

// 新建题目（默认不生效，需另外"设为当前"）
export function createQuestion(text, options) {
  const v = validate(text, options);
  if (v.error) return { ok: false, error: v.error };
  const tx = db.transaction(() => {
    const id = db
      .prepare('INSERT INTO questions (text, is_active) VALUES (?, 0)')
      .run(v.text).lastInsertRowid;
    const ins = db.prepare(
      'INSERT INTO options (question_id, label, position) VALUES (?, ?, ?)'
    );
    v.options.forEach((label, i) => ins.run(id, label, i));
    return id;
  });
  return { ok: true, id: Number(tx()) };
}

// 编辑题目：更新文本并整体替换选项（替换选项会级联清掉该题旧投票，即该题票数重置）
export function updateQuestion(id, text, options) {
  const exists = db.prepare('SELECT id FROM questions WHERE id = ?').get(id);
  if (!exists) return { ok: false, error: '题目不存在' };
  const v = validate(text, options);
  if (v.error) return { ok: false, error: v.error };
  db.transaction(() => {
    db.prepare('UPDATE questions SET text = ? WHERE id = ?').run(v.text, id);
    db.prepare('DELETE FROM options WHERE question_id = ?').run(id); // 级联删除该题投票
    const ins = db.prepare(
      'INSERT INTO options (question_id, label, position) VALUES (?, ?, ?)'
    );
    v.options.forEach((label, i) => ins.run(id, label, i));
  })();
  return { ok: true };
}

// 设为当前题目（同一时刻只有一道生效）
export function activateQuestion(id) {
  const exists = db.prepare('SELECT id FROM questions WHERE id = ?').get(id);
  if (!exists) return { ok: false, error: '题目不存在' };
  db.transaction(() => {
    db.prepare('UPDATE questions SET is_active = 0').run();
    db.prepare('UPDATE questions SET is_active = 1 WHERE id = ?').run(id);
  })();
  return { ok: true };
}

// 清空当前生效题目的票数
export function resetActiveVotes() {
  const q = db.prepare('SELECT id FROM questions WHERE is_active = 1').get();
  if (!q) return { ok: false, error: '当前没有生效题目' };
  const info = db.prepare('DELETE FROM votes WHERE question_id = ?').run(q.id);
  return { ok: true, removed: info.changes };
}
