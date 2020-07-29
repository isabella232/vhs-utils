import window from 'global/window';

// const log2 = Math.log2 ? Math.log2 : (x) => (Math.log(x) / Math.log(2));

// count the number of bits it would take to represent a number
// we used to do this with log2 but BigInt does not support builtin math
// Math.ceil(log2(x));
export const countBits = (x) => x.toString(2).length;
// count the number of whole bytes it would take to represent a number
export const countBytes = (x) => Math.ceil(countBits(x) / 8);
export const padStart = (b, len, str = ' ') => (str.repeat(len) + b.toString()).slice(-len);
export const isTypedArray = (obj) => ArrayBuffer.isView(obj);
export const toUint8 = function(bytes) {
  if (bytes instanceof Uint8Array) {
    return bytes;
  }

  if (!Array.isArray(bytes) && !isTypedArray(bytes) && !(bytes instanceof ArrayBuffer)) {
    // any non-number or NaN leads to emtpy uint8array
    // eslint-disable-next-line
    if (typeof bytes !== 'number' || (typeof bytes === 'number' && bytes !== bytes)) {
      bytes = [];
    } else {
      bytes = [bytes];
    }
  }

  return new Uint8Array(
    bytes && bytes.buffer || bytes,
    bytes && bytes.byteOffset || 0,
    bytes && bytes.byteLength || 0
  );
};

export const toHexString = function(bytes) {
  bytes = toUint8(bytes);

  return bytes.reduce(function(acc, b) {
    return acc + padStart(b.toString(16), 2, '0');
  }, '');
};

export const toBinaryString = function(bytes) {
  bytes = toUint8(bytes);

  return bytes.reduce(function(acc, b) {
    return acc + padStart(b.toString(2), 8, '0');
  }, '');
};
const BigInt = window.BigInt || Number;

const BYTE_TABLE = [
  BigInt('0x1'),
  BigInt('0x100'),
  BigInt('0x10000'),
  BigInt('0x1000000'),
  BigInt('0x100000000'),
  BigInt('0x10000000000'),
  BigInt('0x1000000000000'),
  BigInt('0x100000000000000'),
  BigInt('0x10000000000000000')
];

export const ENDIANNESS = (function() {
  const a = new Uint16Array([0xFFCC]);
  const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);

  if (b[0] === 0xFF) {
    return 'big';
  }

  if (b[0] === 0xCC) {
    return 'little';
  }

  return 'unknown';
})();

export const IS_BIG_ENDIAN = ENDIANNESS === 'big';
export const IS_LITTLE_ENDIAN = ENDIANNESS === 'little';

export const bytesToNumber = function(bytes, {signed = false, le = false} = {}) {
  bytes = toUint8(bytes);
  let number = Array.prototype[(le ? 'reduce' : 'reduceRight')].call(bytes, function(total, byte, i) {
    const exponent = le ? i : Math.abs(i + 1 - bytes.length);

    return total + (BigInt(byte) * BYTE_TABLE[exponent]);
  }, BigInt(0));

  if (signed) {
    const max = BYTE_TABLE[bytes.length] / BigInt(2) - BigInt(1);

    number = BigInt(number);

    if (number > max) {
      number -= max;
      number -= max;
      number -= BigInt(2);
    }
  }

  return Number(number);
};

export const numberToBytes = function(number, {le = false} = {}) {
  // eslint-disable-next-line
  if ((typeof number !== 'bigint' && typeof number !== 'number') || (typeof number === 'number' && number !== number)) {
    number = 0;
  }

  number = BigInt(number);

  const byteCount = countBytes(number);

  const bytes = new Uint8Array(new ArrayBuffer(byteCount));

  for (let i = 0; i < byteCount; i++) {
    const byteIndex = le ? i : Math.abs(i + 1 - bytes.length);

    bytes[byteIndex] = Number((number / BYTE_TABLE[i]) & BigInt(0xFF));

    if (number < 0) {
      bytes[byteIndex] = Math.abs(~bytes[byteIndex]);
      bytes[byteIndex] -= i === 0 ? 1 : 2;
    }
  }

  return bytes;
};
export const bytesToString = (bytes) => {
  if (!bytes) {
    return '';
  }

  // TODO: should toUint8 handle cases where we only have 8 bytes
  // but report more since this is a Uint16+ Array?
  bytes = Array.prototype.slice.call(bytes);

  const string = String.fromCharCode.apply(null, toUint8(bytes));

  try {
    return decodeURIComponent(escape(string));
  } catch (e) {
    // if decodeURIComponent/escape fails, we are dealing with partial
    // or full non string data. Just return the potentially garbled string.
  }

  return string;
};

export const stringToBytes = (string, stringIsBytes) => {
  if (typeof string !== 'string' && string && typeof string.toString === 'function') {
    string = string.toString();
  }

  if (typeof string !== 'string') {
    return new Uint8Array();
  }

  // If the string already is bytes, we don't have to do this
  // otherwise we do this so that we split multi length characters
  // into individual bytes
  if (!stringIsBytes) {
    string = unescape(encodeURIComponent(string));
  }

  const view = new Uint8Array(string.length);

  for (let i = 0; i < string.length; i++) {
    view[i] = string.charCodeAt(i);
  }
  return view;
};

export const concatTypedArrays = (...buffers) => {
  buffers = buffers.filter((b) => b && (b.byteLength || b.length) && typeof b !== 'string');

  if (buffers.length <= 1) {
    // for 0 length we will return empty uint8
    // for 1 length we return the first uint8
    return toUint8(buffers[0]);
  }

  const totalLen = buffers.reduce((total, buf, i) => total + (buf.byteLength || buf.length), 0);
  const tempBuffer = new Uint8Array(totalLen);

  let offset = 0;

  buffers.forEach(function(buf) {
    buf = toUint8(buf);

    tempBuffer.set(buf, offset);
    offset += buf.byteLength;
  });

  return tempBuffer;
};

/**
 * Check if the bytes "b" are contained within bytes "a".
 *
 * @param {Uint8Array|Array} a
 *        Bytes to check in
 *
 * @param {Uint8Array|Array} b
 *        Bytes to check for
 *
 * @param {Object} options
 *        options
 *
 * @param {Array|Uint8Array} [offset=0]
 *        offset to use when looking at bytes in a
 *
 * @param {Array|Uint8Array} [mask=[]]
 *        mask to use on bytes before comparison.
 *
 * @return {boolean}
 *         If all bytes in b are inside of a, taking into account
 *         bit masks.
 */
export const bytesMatch = (a, b, {offset = 0, mask = []} = {}) => {
  a = toUint8(a);
  b = toUint8(b);

  // ie 11 does not support uint8 every
  const fn = b.every ? b.every : Array.prototype.every;

  return b.length &&
    a.length - offset >= b.length &&
    // ie 11 doesn't support every on uin8
    fn.call(b, (bByte, i) => {
      const aByte = (mask[i] ? (mask[i] & a[offset + i]) : a[offset + i]);

      return bByte === aByte;
    });
};

export const sliceBytes = function(src, start, end) {
  if (Uint8Array.prototype.slice) {
    return Uint8Array.prototype.slice.call(src, start, end);
  }
  return new Uint8Array(Array.prototype.slice.call(src, start, end));
};

export const reverseBytes = function(src) {
  if (src.reverse) {
    return src.reverse();
  }

  return Array.prototype.reverse.call(src);
};
