// 切片3：敏感词过滤。词表来自 sensitive-words.txt（一行一个词，方便增减）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORDS_FILE = path.join(__dirname, 'sensitive-words.txt');

// 命中后的处理方式：'mask' = 打码上墙；'block' = 直接拦截不上墙
export const FILTER_MODE = 'mask';

function loadWords() {
  try {
    return fs
      .readFileSync(WORDS_FILE, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
  } catch {
    return []; // 词表不存在时不过滤
  }
}

// 启动时加载一次；修改词表后重启后端生效
const words = loadWords();

// 返回 { masked: 打码后的文本, hit: 是否命中敏感词 }
export function filterText(text) {
  let masked = text;
  let hit = false;
  for (const w of words) {
    if (w && masked.includes(w)) {
      hit = true;
      masked = masked.split(w).join('●'.repeat(w.length));
    }
  }
  return { masked, hit };
}
