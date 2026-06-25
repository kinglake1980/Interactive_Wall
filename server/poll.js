// 切片1：投票闭环的核心逻辑（与 HTTP 层解耦，方便测试）
import db from './db.js';

// 写死的默认题目（后台出题留到切片4）
const DEFAULT_QUESTION = {
  text: '你最喜欢哪种编程语言？',
  options: ['JavaScript', 'Python', 'Go', 'Rust'],
};

// 若当前没有生效题目，则插入默认题目及其选项；返回题目 id
export function ensureDefaultQuestion() {
  const active = db.prepare('SELECT id FROM questions WHERE is_active = 1 LIMIT 1').get();
  if (active) return active.id;

  const insert = db.transaction(() => {
    const qId = db
      .prepare('INSERT INTO questions (text, is_active) VALUES (?, 1)')
      .run(DEFAULT_QUESTION.text).lastInsertRowid;
    const insertOption = db.prepare(
      'INSERT INTO options (question_id, label, position) VALUES (?, ?, ?)'
    );
    DEFAULT_QUESTION.options.forEach((label, i) => insertOption.run(qId, label, i));
    return qId;
  });
  return insert();
}

// 读取当前题目、各选项票数与百分比
export function getPoll() {
  const q = db
    .prepare('SELECT id, text FROM questions WHERE is_active = 1 ORDER BY id DESC LIMIT 1')
    .get();
  if (!q) return null;

  const options = db
    .prepare(
      `SELECT o.id, o.label,
              (SELECT COUNT(*) FROM votes v WHERE v.option_id = o.id) AS votes
         FROM options o
        WHERE o.question_id = ?
        ORDER BY o.position, o.id`
    )
    .all(q.id);

  const total = options.reduce((sum, o) => sum + o.votes, 0);

  return {
    question: q,
    totalVotes: total,
    options: options.map((o) => ({
      ...o,
      percent: total === 0 ? 0 : Math.round((o.votes / total) * 100),
    })),
  };
}

// 投一票（PRD：不限制重复投票）
export function castVote(optionId) {
  const opt = db.prepare('SELECT id, question_id FROM options WHERE id = ?').get(optionId);
  if (!opt) return { ok: false, error: '选项不存在' };
  db.prepare('INSERT INTO votes (question_id, option_id) VALUES (?, ?)').run(
    opt.question_id,
    opt.id
  );
  return { ok: true };
}
