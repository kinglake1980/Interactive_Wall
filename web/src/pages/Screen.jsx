// 大屏页（投影）——切片1：票数柱状图；切片2：弹幕；切片5：扫码二维码
import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { audienceUrlFromOrigin } from '../lib/url.js';

const POLL_INTERVAL_MS = 1500;
const LANES = 6; // 弹幕轨道数

// 观众页网址（取大屏当前访问的源，手机扫码即可到达同一地址）
const AUDIENCE_URL = audienceUrlFromOrigin(window.location.origin);

export default function Screen() {
  const [poll, setPoll] = useState(null);
  const [error, setError] = useState('');

  // 弹幕：当前正在飞的留言
  const [danmaku, setDanmaku] = useState([]);
  const lastMsgIdRef = useRef(null); // null 表示尚未拿到基线
  const laneRef = useRef(0);
  const keyRef = useRef(0);

  // 投票柱状图轮询
  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const res = await fetch('/api/poll');
        const data = await res.json();
        if (!alive) return;
        if (!data.ok) throw new Error(data.error || '加载失败');
        setPoll(data);
        setError('');
      } catch (e) {
        if (alive) setError(e.message);
      }
    }
    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // 留言轮询：只飞"打开大屏之后"的新留言
  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const after = lastMsgIdRef.current ?? 0;
        const res = await fetch(`/api/messages?after=${after}`);
        const data = await res.json();
        if (!alive || !data.ok) return;

        if (lastMsgIdRef.current === null) {
          // 首次：以当前最大 id 为基线，不回放历史留言
          lastMsgIdRef.current = data.maxId;
          return;
        }
        if (data.messages.length > 0) {
          const incoming = data.messages.map((m) => {
            const lane = laneRef.current % LANES;
            laneRef.current += 1;
            return {
              key: `${m.id}-${keyRef.current++}`,
              content: m.content,
              lane,
              duration: 9 + Math.random() * 4, // 9~13s
            };
          });
          setDanmaku((prev) => [...prev, ...incoming]);
          lastMsgIdRef.current = data.maxId;
        }
      } catch {
        /* 忽略单次轮询失败 */
      }
    }
    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  function removeDanmaku(key) {
    setDanmaku((prev) => prev.filter((d) => d.key !== key));
  }

  return (
    <div className="page screen">
      {/* 弹幕层：覆盖全屏，从右往左飞 */}
      <div className="danmaku-layer">
        {danmaku.map((d) => (
          <div
            key={d.key}
            className="danmaku-item"
            style={{
              top: `${6 + d.lane * 13}%`,
              animationDuration: `${d.duration}s`,
            }}
            onAnimationEnd={() => removeDanmaku(d.key)}
          >
            {d.content}
          </div>
        ))}
      </div>

      {/* 扫码入口：观众扫这个二维码进观众页 */}
      <div className="qr-panel">
        <QRCodeSVG value={AUDIENCE_URL} size={140} level="M" includeMargin />
        <div className="qr-caption">扫码参与投票/留言</div>
        <div className="qr-url">{AUDIENCE_URL}</div>
      </div>

      <div className="tag">大屏页 / 投影</div>
      {error && <div className="placeholder">出错了：{error}</div>}
      {!poll && !error && <div className="placeholder">加载中…</div>}
      {poll && (
        <>
          <h1>{poll.question.text}</h1>
          <div className="chart">
            {poll.options.map((o) => (
              <div className="bar-col" key={o.id}>
                <div className="bar-figure">
                  <div className="bar-percent">{o.percent}%</div>
                  <div className="bar" style={{ height: `${o.percent}%` }} />
                </div>
                <div className="bar-label">{o.label}</div>
                <div className="bar-votes">{o.votes} 票</div>
              </div>
            ))}
          </div>
          <div className="total">共 {poll.totalVotes} 票 · 每 1.5 秒自动刷新</div>
        </>
      )}
    </div>
  );
}
