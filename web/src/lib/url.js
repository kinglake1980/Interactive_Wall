// 由当前大屏访问的源（origin）推导观众页网址
// 大屏开在哪个地址（localhost 或局域网/公网 IP），二维码就指向同一地址的根路径
export function audienceUrlFromOrigin(origin) {
  return String(origin).replace(/\/+$/, '') + '/';
}
