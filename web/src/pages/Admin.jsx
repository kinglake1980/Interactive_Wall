// 主持人后台页——切片4：密码进入 + 题目新建/编辑/切换/清空票数
import { useEffect, useState } from 'react';

const PW_KEY = 'adminPw';

export default function Admin() {
  const [pw, setPw] = useState(() => sessionStorage.getItem(PW_KEY) || '');
  const [authed, setAuthed] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [questions, setQuestions] = useState([]);
  const [editing, setEditing] = useState(null); // {id|null, text, options:[]}
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // 带密码的请求
  async function api(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'x-admin-password': pw, ...(options.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      setAuthed(false);
      sessionStorage.removeItem(PW_KEY);
      throw new Error('密码错误或登录已失效');
    }
    if (!data.ok) throw new Error(data.error || '操作失败');
    return data;
  }

  async function loadQuestions() {
    try {
      const data = await api('/api/admin/questions');
      setQuestions(data.questions);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  // 若 sessionStorage 里已有密码，自动尝试进入
  useEffect(() => {
    if (!pw) return;
    (async () => {
      try {
        await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: pw }) });
        setAuthed(true);
        loadQuestions();
      } catch {
        /* 等待手动登录 */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(e) {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
        body: JSON.stringify({ password: pw }),
      });
      if (res.status === 401) throw new Error('密码错误');
      sessionStorage.setItem(PW_KEY, pw);
      setAuthed(true);
      loadQuestions();
    } catch (err) {
      setLoginError(err.message);
    }
  }

  function logout() {
    sessionStorage.removeItem(PW_KEY);
    setAuthed(false);
    setPw('');
    setQuestions([]);
    setEditing(null);
  }

  function flash(msg) {
    setNotice(msg);
    setTimeout(() => setNotice(''), 2500);
  }

  // ---- 编辑表单操作 ----
  function startNew() {
    setEditing({ id: null, text: '', options: ['', ''] });
  }
  function startEdit(q) {
    setEditing({ id: q.id, text: q.text, options: q.options.map((o) => o.label) });
  }
  function setOption(i, val) {
    setEditing((e) => ({ ...e, options: e.options.map((o, idx) => (idx === i ? val : o)) }));
  }
  function addOption() {
    setEditing((e) => ({ ...e, options: [...e.options, ''] }));
  }
  function removeOption(i) {
    setEditing((e) => ({ ...e, options: e.options.filter((_, idx) => idx !== i) }));
  }

  async function save() {
    if (!editing) return;
    try {
      const body = JSON.stringify({ text: editing.text, options: editing.options });
      if (editing.id == null) {
        await api('/api/admin/questions', { method: 'POST', body });
        flash('已新建题目（如需投影请点"设为当前"）');
      } else {
        await api(`/api/admin/questions/${editing.id}`, { method: 'PUT', body });
        flash('已保存（该题票数已重置）');
      }
      setEditing(null);
      loadQuestions();
    } catch (e) {
      setError(e.message);
    }
  }

  async function activate(id) {
    try {
      await api(`/api/admin/questions/${id}/activate`, { method: 'POST' });
      flash('已设为当前题目，观众页/大屏会在下次刷新切换');
      loadQuestions();
    } catch (e) {
      setError(e.message);
    }
  }

  async function exportCsv() {
    try {
      const res = await fetch('/api/admin/export', {
        headers: { 'x-admin-password': pw },
      });
      if (res.status === 401) {
        setAuthed(false);
        sessionStorage.removeItem(PW_KEY);
        throw new Error('密码错误或登录已失效');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'interactive-wall-export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      flash('已导出 CSV');
    } catch (e) {
      setError(e.message);
    }
  }

  async function resetVotes() {
    if (!window.confirm('确定清空当前题目的票数？')) return;
    try {
      await api('/api/admin/reset-votes', { method: 'POST' });
      flash('当前题目票数已清空');
      loadQuestions();
    } catch (e) {
      setError(e.message);
    }
  }

  // ---- 登录界面 ----
  if (!authed) {
    return (
      <div className="page">
        <div className="tag">主持人后台</div>
        <h1>请输入后台密码</h1>
        <form className="login-form" onSubmit={login}>
          <input
            type="password"
            className="msg-input"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="后台密码"
            autoFocus
          />
          <button className="msg-send" type="submit">进入</button>
        </form>
        {loginError && <div className="msg-error">{loginError}</div>}
        <div className="nav">
          其它页面：<a href="/">观众页</a> | <a href="/screen">大屏页</a>
        </div>
      </div>
    );
  }

  // ---- 后台主界面 ----
  return (
    <div className="page admin">
      <div className="admin-head">
        <div className="tag">主持人后台</div>
        <div className="admin-head-actions">
          <button className="link-btn" onClick={exportCsv}>导出 CSV</button>
          <button className="link-btn" onClick={logout}>退出</button>
        </div>
      </div>

      {error && <div className="msg-error">{error}</div>}
      {notice && <div className="msg-ok">{notice}</div>}

      <div className="admin-cols">
        <section className="admin-card">
          <div className="admin-card-title">
            题库
            <button className="link-btn" onClick={startNew}>+ 新建题目</button>
          </div>
          {questions.length === 0 && <div className="placeholder">暂无题目</div>}
          <ul className="q-list">
            {questions.map((q) => (
              <li key={q.id} className={'q-item' + (q.is_active ? ' active' : '')}>
                <div className="q-text">
                  {q.is_active && <span className="q-badge">当前</span>}
                  {q.text}
                  <span className="q-meta"> · {q.options.length} 个选项</span>
                </div>
                <div className="q-actions">
                  <button className="link-btn" onClick={() => startEdit(q)}>编辑</button>
                  {!q.is_active && (
                    <button className="link-btn" onClick={() => activate(q.id)}>设为当前</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <button className="msg-send" onClick={resetVotes}>清空当前题目票数</button>
        </section>

        <section className="admin-card">
          <div className="admin-card-title">
            {editing == null ? '编辑区' : editing.id == null ? '新建题目' : `编辑题目 #${editing.id}`}
          </div>
          {editing == null ? (
            <div className="placeholder">从左侧点"编辑"或"新建题目"开始</div>
          ) : (
            <div className="editor">
              <label className="editor-label">题目</label>
              <input
                className="msg-input"
                value={editing.text}
                onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                placeholder="输入题目"
              />
              <label className="editor-label">选项</label>
              {editing.options.map((o, i) => (
                <div className="opt-row" key={i}>
                  <input
                    className="msg-input"
                    value={o}
                    onChange={(e) => setOption(i, e.target.value)}
                    placeholder={`选项 ${i + 1}`}
                  />
                  {editing.options.length > 2 && (
                    <button className="link-btn" onClick={() => removeOption(i)}>删除</button>
                  )}
                </div>
              ))}
              <button className="link-btn" onClick={addOption}>+ 添加选项</button>
              {editing.id != null && (
                <div className="editor-warn">注意：保存会重置该题已有票数</div>
              )}
              <div className="editor-actions">
                <button className="msg-send" onClick={save}>保存</button>
                <button className="link-btn" onClick={() => setEditing(null)}>取消</button>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="nav">
        其它页面：<a href="/">观众页</a> | <a href="/screen">大屏页</a>
      </div>
    </div>
  );
}
