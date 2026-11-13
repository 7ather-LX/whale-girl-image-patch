'use strict';

const dns = require('dns').promises;
const net = require('net');

const PRIVATE_V4 = [
  [/^10\./, '10/8'],
  [/^127\./, '127/8'],
  [/^169\.254\./, 'link-local'],
  [/^172\.(1[6-9]|2\d|3[01])\./, '172.16/12'],
  [/^192\.168\./, '192.168/16'],
  [/^0\./, '0/8'],
  [/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, '100.64/10'],
  [/^198\.1[89]\./, 'benchmark'],
  [/^22[4-9]\.|^23\d\.|^24\d\.|^25[0-5]\./, 'multicast/reserved'],
];

function isPrivateAddress(ip) {
  ip = String(ip || '').trim();
  if (!ip) return true;
  if (net.isIPv4(ip)) return PRIVATE_V4.some(([re]) => re.test(ip));
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low === '::' || low === '::1') return true;
    if (/^f[cd][0-9a-f]{2}:/.test(low)) return true;
    if (/^fe[89ab][0-9a-f]:/.test(low)) return true;
    if (/^ff[0-9a-f]{2}:/.test(low)) return true;
    if (low.startsWith('::ffff:')) {
      const v4 = low.slice(7);
      if (net.isIPv4(v4)) return isPrivateAddress(v4);
    }
  }
  return false;
}

async function assertPublicUrl(raw, { allowHosts = [] } = {}) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('invalid URL'); }
  if (url.protocol !== 'https:') throw new Error('only https is allowed');
  if (url.username || url.password) throw new Error('credentials in URL are not allowed');
  const host = url.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new Error('local host is not allowed');
  }
  if (allowHosts.length && !allowHosts.some((h) => host === h || host.endsWith('.' + h))) {
    throw new Error('host is not in the allow list');
  }
  const addrs = await dns.lookup(host, { all: true });
  if (!addrs.length) throw new Error('host did not resolve');
  for (const a of addrs) {
    if (isPrivateAddress(a.address)) throw new Error('private address is not allowed');
  }
  return url;
}

function isImageMime(mime) {
  return /^image\/(jpeg|jpg|png|webp|gif)$/i.test(String(mime || '').split(';')[0].trim());
}

function sniff(buf) {
  if (!buf || buf.length < 12) return '';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.slice(0, 3).toString('ascii') === 'GIF') return 'image/gif';
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return '';
}

module.exports = { assertPublicUrl, isPrivateAddress, isImageMime, sniff };
