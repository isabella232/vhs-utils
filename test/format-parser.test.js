import QUnit from 'qunit';
import formatFiles from 'create-test-data!formats';
import {parseFormatForBytes} from '../src/format-parser.js';
import {isVideoCodec, isAudioCodec} from '../src/codecs.js';

// codecs that are equivlent and reported differently depending on the container
const aliasMap = {
  mp3: ['mp3', 'mp4a.40.34', 'mp4a.6b'],
  aac: ['aac', 'mp4a.40.2', 'mp4a.40.5', 'mp4a.40.29']
};

Object.keys(aliasMap).forEach((alias) => {
  // map aliases as keys so that everything is linked to each other
  aliasMap[alias].forEach((subalias) => {
    aliasMap[subalias] = aliasMap[alias];
  });
});

const modules = {};

// seperate files into modules by extension
Object.keys(formatFiles).forEach((file) => {
  const extension = file.split('.').pop();

  modules[extension] = modules[extension] || [];
  modules[extension].push(file);
});

QUnit.module('parseFormatForBytes', () => Object.keys(modules).forEach(function(module) {
  const files = modules[module];

  QUnit.module(module);

  files.forEach((file) => QUnit.test(`${file} can be identified`, function(assert) {
    const {codecs, container} = parseFormatForBytes(formatFiles[file]());
    const expectedCodecs = {};
    const codecStr = file.replace('.' + module, '');

    codecStr.split(',').forEach((codec) => {
      if (isVideoCodec(codec)) {
        expectedCodecs.video = codec;
      } else if (isAudioCodec(codec)) {
        expectedCodecs.audio = codec;
      } else {
        throw new Error(`${codec} is not detected as audio or video`);
      }
    });

    assert.equal(container, module, module);
    Object.keys(expectedCodecs).forEach(function(type) {
      const expectedCodec = expectedCodecs[type];
      const codec = codecs[type];

      if (aliasMap[expectedCodec]) {
        assert.notEqual(aliasMap[codec].indexOf(expectedCodec), -1, `alias match ${codec} -> ${expectedCodec}`);
      } else {
        assert.equal(codec, expectedCodec, expectedCodec);
      }
    });
  }));
}));
