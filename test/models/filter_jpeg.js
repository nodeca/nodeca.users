'use strict';


const assert      = require('assert');
const fs          = require('fs');
const glob        = require('glob').sync;
const path        = require('path');
const filter_jpeg = require('nodeca.users/models/users/_lib/filter_jpeg');


function addTestBlock(TypedArray) {
  let fixtures = {};
  let cwd = path.join(__dirname, 'fixtures');

  glob('*.jpeg.txt', { cwd })
    .filter(name => !/^[._]|\\[._]|\/[_.]/.test(name))
    .forEach(name => {
      let hex = fs.readFileSync(path.join(cwd, name), 'utf8').replace(/;.*/mg, '');
      let buf = new Buffer(hex.match(/[0-9a-f]{2}/gi).map(i => parseInt(i, 16)));

      fixtures[name.replace(/\.jpeg\.txt$/, '')] = buf;
    });

  function addTest(args, source, equals, callback) {
    let filter = filter_jpeg(args);

    filter.onEnd = function () {
      let buffer = new TypedArray(Buffer.concat(filter.output));

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

  it('should fail on error', function (callback) {
    let filter = filter_jpeg();

    filter.onError = function (err) {
      assert.equal(err.message, 'unexpected byte at segment start: 0x44 (offset 0x02)');
      callback();
    };

    filter.push(new TypedArray([ 0xFF, 0xD8, 0x44 ]));
    filter.end();
  });
}


describe('filter_jpeg (Buffer)', function () {
  addTestBlock(Buffer);
});


describe('filter_jpeg (Uint8Array)', function () {
  addTestBlock(Uint8Array);
});
