// 切片6：把票数与留言导出成一个 CSV（字符串），与 HTTP 层解耦，方便测试
import db from './db.js';

// CSV 单元格转义：含逗号/引号/换行时用双引号包裹，内部引号翻倍
function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function csvRow(arr) {
  return arr.map(csvCell).join(',');
}

// 生成一个 CSV：前半是各题各选项的票数，后半是留言。用"类型"列区分两类行
export function buildExportCsv() {
  const rows = [['类型', '题目', '选项', '票数', '留言内容', '时间']];

  // 投票统计（含所有历史题目，不只当前题目）
  const questions = db.prepare('SELECT id, text FROM questions ORDER BY id').all();
  const optStmt = db.prepare(
    `SELECT o.label,
            (SELECT COUNT(*) FROM votes v WHERE v.option_id = o.id) AS votes
       FROM options o WHERE o.question_id = ? ORDER BY o.position, o.id`
  );
  for (const q of questions) {
    for (const o of optStmt.all(q.id)) {
      rows.push(['投票', q.text, o.label, o.votes, '', '']);
    }
  }

  // 留言（导出上墙展示版，即敏感词打码后的内容）
  const messages = db
    .prepare(
      `SELECT COALESCE(masked_content, content) AS content, created_at
         FROM messages WHERE status = 'visible' ORDER BY id`
    )
    .all();
  for (const m of messages) {
    rows.push(['留言', '', '', '', m.content, m.created_at]);
  }

  return rows.map(csvRow).join('\r\n');
}
