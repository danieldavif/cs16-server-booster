/**
 * CS 1.6 Server Query Service
 * Uses the Source/GoldSrc "A2S_INFO" UDP query protocol
 */
const dgram = require('dgram');

const A2S_INFO_PAYLOAD = Buffer.from([
  0xFF, 0xFF, 0xFF, 0xFF, 0x54,
  0x53, 0x6F, 0x75, 0x72, 0x63, 0x65,
  0x20, 0x45, 0x6E, 0x67, 0x69, 0x6E,
  0x65, 0x20, 0x51, 0x75, 0x65, 0x72, 0x79, 0x00
]);

function readNullString(buf, offset) {
  let end = buf.indexOf(0x00, offset);
  if (end === -1) end = buf.length;
  return { value: buf.slice(offset, end).toString('utf8'), next: end + 1 };
}

function parseA2SInfo(buf) {
  try {
    if (buf.length < 6) return null;
    let offset = 4; // skip 0xFF 0xFF 0xFF 0xFF
    const header = buf[offset++];
    if (header !== 0x49 && header !== 0x6D) return null; // 'I' or legacy 'm'

    if (header === 0x49) {
      offset++; // protocol
      const s1 = readNullString(buf, offset); offset = s1.next; // name
      const s2 = readNullString(buf, offset); offset = s2.next; // map
      const s3 = readNullString(buf, offset); offset = s3.next; // folder
      const s4 = readNullString(buf, offset); offset = s4.next; // game
      offset += 2; // id
      const players = buf[offset++];
      const maxPlayers = buf[offset++];
      return { name: s1.value, map: s2.value, players, maxPlayers };
    }
    // Legacy 'm' format
    const s1 = readNullString(buf, offset); offset = s1.next; // addr
    const s2 = readNullString(buf, offset); offset = s2.next; // name
    const s3 = readNullString(buf, offset); offset = s3.next; // map
    const s4 = readNullString(buf, offset); offset = s4.next; // folder
    const s5 = readNullString(buf, offset); offset = s5.next; // game
    const players = buf[offset++];
    const maxPlayers = buf[offset++];
    return { name: s2.value, map: s3.value, players, maxPlayers };
  } catch { return null; }
}

function queryServer(ip, port, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const client = dgram.createSocket('udp4');
    let done = false;

    const finish = (result) => {
      if (done) return;
      done = true;
      try { client.close(); } catch {}
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({ online: false, ping: null, players: 0, maxPlayers: 0, name: '', map: '' });
    }, timeoutMs);

    client.once('error', () => {
      clearTimeout(timer);
      finish({ online: false, ping: null, players: 0, maxPlayers: 0, name: '', map: '' });
    });

    client.on('message', (msg) => {
      clearTimeout(timer);
      const ping = Date.now() - start;
      const info = parseA2SInfo(msg);
      if (info) {
        finish({ online: true, ping, players: info.players, maxPlayers: info.maxPlayers, name: info.name, map: info.map });
      } else {
        finish({ online: false, ping: null, players: 0, maxPlayers: 0, name: '', map: '' });
      }
    });

    client.send(A2S_INFO_PAYLOAD, 0, A2S_INFO_PAYLOAD.length, parseInt(port), ip, (err) => {
      if (err) { clearTimeout(timer); finish({ online: false }); }
    });
  });
}

module.exports = { queryServer };
