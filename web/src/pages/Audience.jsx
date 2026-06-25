// 观众页（手机）——切片1：投票；切片2：发留言（弹幕）
import { useEffect, useState } from 'react';

const MSG_MAX_LEN = 50;
const MSG_MIN_INTERVAL_MS = 3000; // 同一浏览器两条留言至少间隔 3 秒

export default function Audience() {
  const [poll, setPoll] = useState(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [justVoted, setJustVoted] = useState(null);

  const [msg, setMsg] = useState('');
  const [msgError, setMsgError] = useState('');
  const [msgHint, setMsgHint] = useState('');

  async function loadPoll() {
    try {
      const res = await fetch('/api/poll');
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '加载失败');
      setPoll(data);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    loadPoll();
  }, []);

  async function vote(optionId) {
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/poll/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '投票失败');
      setPoll(data);
      setJustVoted(optionId);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  async function sendMessage() {
    setMsgError('');
    setMsgHint('');
    const text = msg.trim();
    if (!text) {
      setMsgError('请先输入内容');
      return;
    }
    if (text.length > MSG_MAX_LEN) {
      setMsgError(`最多 ${MSG_MAX_LEN} 字`);
      return;
    }
    // 同一浏览器的发送频率限制（防刷屏）
    const last = Number(localStorage.getItem('lastMsgAt') || 0);
    const wait = MSG_MIN_INTERVAL_MS - (Date.now() - last);
    if (wait > 0) {
      setMsgError(`发太快了，请 ${Math.ceil(wait / 1000)} 秒后再发`);
      return;
    }
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '发送失败');
      localStorage.setItem('lastMsgAt', String(Date.now()));
      setMsg('');
      setMsgHint('已发送，留意大屏');
    } catch (e) {
      setMsgError(e.message);
    }
  }

  return (
    <div className="page">
      <div className="tag">观众页 / 手机</div>
      {error && <div className="placeholder">出错了：{error}</div>}
      {!poll && !error && <div className="placeholder">加载中…</div>}
      {poll && (
        <>
          <h1>{poll.question.text}</h1>
          <div className="options">
            {poll.options.map((o) => (
              <button
                key={o.id}
                className={'option-btn' + (justVoted === o.id ? ' voted' : '')}
                onClick={() => vote(o.id)}
                disabled={sending}
              >
                {o.label}
              </button>
            ))}
          </div>
          {justVoted != null && <div className="vote-hint">已投出一票，可继续投</div>}
        </>
      )}

      <div className="msg-box">
        <div className="msg-title">发一句话上墙</div>
        <textarea
          className="msg-input"
          value={msg}
          maxLength={MSG_MAX_LEN}
          rows={2}
          placeholder="说点什么…（最多 50 字）"
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />
        <div className="msg-row">
          <span className="msg-count">{msg.length}/{MSG_MAX_LEN}</span>
          <button className="msg-send" onClick={sendMessage}>
            发送
          </button>
        </div>
        {msgError && <div className="msg-error">{msgError}</div>}
        {msgHint && <div className="msg-ok">{msgHint}</div>}
      </div>

      <div className="nav">
        其它页面：<a href="/screen">大屏页</a> | <a href="/admin">主持人后台</a>
      </div>
    </div>
  );
}
