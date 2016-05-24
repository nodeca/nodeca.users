'use strict';


const assert      = require('assert');
const fs          = require('fs');
const glob        = require('glob').sync;
const path        = require('path');
const filter_jpeg = require('nodeca.users/lib/filter_jpeg');
const Promise     = require('bluebird');

function addTestBlock(TypedArray) {
  let fixtures = {};
  let cwd = path.join(__dirname, 'fixtures');

  glob('*.jpeg.txt', { cwd })
    .filter(name => !/^[._]|\\[._]|\/[_.]/.test(name))
    .forEach(name => {
      let hex = fs.readFileSync(path.join(cwd, name), 'utf8').replace(/;.*/mg, '');
      let buf = new TypedArray(hex.match(/[0-9a-f]{2}/gi).map(i => parseInt(i, 16)));

      fixtures[name.replace(/\.jpeg\.txt$/, '')] = buf;
    });

  function addTest(args, source, equals, callback) {
    let filter = filter_jpeg(args);

    filter.onEnd = function () {
      let buffer = new TypedArray(Buffer.concat(filter.output.map(Buffer)));

      assert.deepEqual(buffer, equals);
      callback();
    };

    filter.push(source);
    filter.end();
  }

  it('should leave file as is if no options', function (callback) {
    addTest({},
            fixtures['jpeg1-orig'],
            fixtures['jpeg1-orig'],
            callback);
  });

  it('should add a comment', function (callback) {
    addTest({ comment: 'hèllo wõrld！ 😼' },
            fixtures['jpeg1-orig'],
            fixtures['jpeg1-comment'],
            callback);
  });

  it('should remove jpeg padding', function (callback) {
    addTest({},
            fixtures['jpeg1-padded'],
            fixtures['jpeg1-orig'],
            callback);
  });

  it('should produce the same result if file is split', function (callback) {
    let filter = filter_jpeg();

    filter.onEnd = function () {
      let buffer = new TypedArray(Buffer.concat(filter.output.map(Buffer)));

      assert.deepEqual(buffer, fixtures['jpeg1-orig']);
      callback();
    };

    for (let i = 0; i < fixtures['jpeg1-padded'].length; i++) {
      filter.push(new TypedArray([ fixtures['jpeg1-padded'][i] ]));
    }

    filter.end();
  });

  it('removeImage should strip everything', function (callback) {
    addTest({ removeImage: true },
            fixtures['jpeg1-comment'],
            new TypedArray('FF D8 FF FE 00 18 68 C3 A8 6C 6C 6F 20 77 C3 B5 72 6C 64 EF BC 81 20 F0 9F 98 BC 00 FF D9'
              .match(/[0-9a-f]{2}/gi).map(i => parseInt(i, 16))),
            callback);

  });

  it('should fail on errors', function () {
    let errors = {
      '':            'unexpected end of file (offset 0x00)',
      FF:            'unexpected end of file (offset 0x01)',
      'FF 00':       'unknown file format',
      'FF D8 44':    'unexpected byte at segment start: 0x44 (offset 0x02)',
      'FF D8 FF 44': 'unknown marker: 0x44 (offset 0x03)'
    };

    return Promise.map(Object.keys(errors), hex => Promise.fromCallback(cb => {
      let filter = filter_jpeg();

      filter.onError = function (err) {
        assert.equal(err.message, errors[hex]);
        cb();
      };

      filter.push(new TypedArray((hex.match(/[0-9a-f]{2}/gi) || []).map(i => parseInt(i, 16))));
      filter.end();
    }));
  });
}


describe('filter_jpeg (Buffer)', function () {
  addTestBlock(Buffer);
});


describe('filter_jpeg (Uint8Array)', function () {
  addTestBlock(Uint8Array);
});
