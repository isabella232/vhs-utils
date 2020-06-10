import {toUint8, bytesMatch} from './byte-helpers.js';
import {findBox} from './mp4-helpers.js';
import {findEbml, EBML_TAGS} from './ebml-helpers.js';
import {getId3Offset} from './id3-helpers.js';

const CONSTANTS = {
  // "webm" string literal in hex
  'webm': toUint8([0x77, 0x65, 0x62, 0x6d]),

  // "matroska" string literal in hex
  'matroska': toUint8([0x6d, 0x61, 0x74, 0x72, 0x6f, 0x73, 0x6b, 0x61]),

  // "fLaC" string literal in hex
  'flac': toUint8([0x66, 0x4c, 0x61, 0x43]),

  // "OggS" string literal in hex
  'ogg': toUint8([0x4f, 0x67, 0x67, 0x53]),

  // ac3 sync byte
  'ac3': toUint8([0x0b, 0x77]),

  // "RIFF" string literal in hex used for wav and avi
  'riff': toUint8([0x52, 0x49, 0x46, 0x46]),

  // "AVI" string literal in hex
  'avi': toUint8([0x41, 0x56, 0x49]),

  // "WAVE" string literal in hex
  'wav': toUint8([0x57, 0x41, 0x56, 0x45]),

  // "ftyp3g" string literal in hex
  '3gp': toUint8([0x66, 0x74, 0x79, 0x70, 0x33, 0x67]),

  // "ftyp" string literal in hex
  'mp4': toUint8([0x66, 0x74, 0x79, 0x70]),

  // "styp" string literal in hex
  'fmp4': toUint8([0x73, 0x74, 0x79, 0x70]),

  // "ftyp" string literal in hex
  'mov': toUint8([0x66, 0x74, 0x79, 0x70, 0x71, 0x74])

};

const _isLikely = {
  aac(bytes) {
    const offset = getId3Offset(bytes);

    return bytesMatch(bytes, [0xFF, 0x10], {offset, mask: [0xFF, 0x16]});
  },

  mp3(bytes) {
    const offset = getId3Offset(bytes);

    return bytesMatch(bytes, [0xFF, 0x02], {offset, mask: [0xFF, 0x06]});
  },

  webm(bytes) {
    const docType = findEbml(bytes, [EBML_TAGS.EBML, EBML_TAGS.DocType])[0];

    // check if DocType EBML tag is webm
    return bytesMatch(docType, CONSTANTS.webm);
  },

  mkv(bytes) {
    const docType = findEbml(bytes, [EBML_TAGS.EBML, EBML_TAGS.DocType])[0];

    // check if DocType EBML tag is matroska
    return bytesMatch(docType, CONSTANTS.matroska);
  },

  mp4(bytes) {
    return !_isLikely['3gp'](bytes) && !_isLikely.mov(bytes) &&
      (bytesMatch(bytes, CONSTANTS.mp4, {offset: 4}) ||
       bytesMatch(bytes, CONSTANTS.fmp4, {offset: 4}));
  },
  mov(bytes) {
    return bytesMatch(bytes, CONSTANTS.mov, {offset: 4});
  },
  '3gp'(bytes) {
    return bytesMatch(bytes, CONSTANTS['3gp'], {offset: 4});
  },
  ac3(bytes) {
    return bytesMatch(bytes, CONSTANTS.ac3);
  },

  ts(bytes) {
    if (bytes.length < 189 && bytes.length >= 1) {
      return bytes[0] === 0x47;
    }

    let i = 0;

    // check the first 376 bytes for two matching sync bytes
    while (i + 188 < bytes.length && i < 188) {
      if (bytes[i] === 0x47 && bytes[i + 188] === 0x47) {
        return true;
      }
      i += 1;
    }

    return false;
  },

  flac(bytes) {
    return bytesMatch(bytes, CONSTANTS.flac);
  },
  ogg(bytes) {
    return bytesMatch(bytes, CONSTANTS.ogg);
  },
  avi(bytes) {
    return bytesMatch(bytes, CONSTANTS.riff) &&
      bytesMatch(bytes, CONSTANTS.avi, {offset: 8});
  },
  wav(bytes) {
    return bytesMatch(bytes, CONSTANTS.riff) &&
      bytesMatch(bytes, CONSTANTS.wav, {offset: 8});
  }
};

// get all the isLikely functions
// but make sure 'ts' is at the bottom
// as it is the least specific
const isLikelyTypes = Object.keys(_isLikely)
  // remove ts
  .filter((t) => t !== 'ts')
  // add it back to the bottom
  .concat('ts');

// make sure we are dealing with uint8 data.
isLikelyTypes.forEach(function(type) {
  const isLikelyFn = _isLikely[type];

  _isLikely[type] = (bytes) => isLikelyFn(toUint8(bytes));
});

// export after wrapping
export const isLikely = _isLikely;

// A useful list of file signatures can be found here
// https://en.wikipedia.org/wiki/List_of_file_signatures
export const detectContainerForBytes = (bytes) => {
  bytes = toUint8(bytes);

  for (let i = 0; i < isLikelyTypes.length; i++) {
    const type = isLikelyTypes[i];

    if (isLikely[type](bytes)) {
      return type;
    }
  }

  return '';
};

// fmp4 is not a container
export const isLikelyFmp4MediaSegment = (bytes) => {
  return findBox(bytes, ['moof']).length > 0;
};
