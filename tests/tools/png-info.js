'use strict';
// Reads width, height and colorType from the IHDR chunk of a PNG buffer.
function readPngInfo(buffer) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buffer.length < 26 || !sig.every((b, i) => buffer[i] === b)) { throw new Error('not a PNG'); }
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') { throw new Error('IHDR chunk missing'); }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), colorType: buffer[25] };
}
module.exports = { readPngInfo };
