'use strict';


const assert      = require('assert');
const from2       = require('from2');
const fs          = require('fs');
const glob        = require('glob').sync;
const path        = require('path');
const pump        = require('pump');
const filter_jpeg = require('nodeca.users/models/users/_lib/filter_jpeg');


function toBuffer(stream, callback) {
  let data = [];

  stream.on('data',  d => data.push(d));
  stream.on('end',   () => callback(null, Buffer.concat(data)));
  stream.on('error', callback);
}


describe('filter_jpeg', function () {
  let fixtures = {};
  let cwd = path.join(__dirname, 'fixtures');

  glob('*.jpeg.txt', { cwd })
    .filter(name => !/^[._]|\\[._]|\/[_.]/.test(name))
    .forEach(name => {
      let hex = fs.readFileSync(path.join(cwd, name), 'utf8');
      let buf = new Buffer(hex.replace(/;.*/mg, '').replace(/\s*/g, ''), 'hex');

      fixtures[name.replace(/\.jpeg\.txt$/, '')] = buf;
    });

  function addTest(args, source, equals, callback) {
    toBuffer(pump(from2([ source ]), filter_jpeg(args)), (err, buffer) => {
      if (err) throw err;

      assert.deepEqual(buffer, equals);
      callback();
    });
  }

  it('should leave file as is if no options', function (callback) {
    addTest({},
            fixtures['jpeg1-orig'],
            fixtures['jpeg1-orig'],
            callback);
  });

  it('should add a comment', function (callback) {
    addTest({ comment: 'hello world' },
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
    let arr = [];

    for (let i = 0; i < fixtures['jpeg1-padded'].length; i++) {
      arr.push(new Buffer([ fixtures['jpeg1-padded'][i] ]));
    }

    toBuffer(pump(from2(arr), filter_jpeg()), (err, buffer) => {
      if (err) throw err;

      assert.deepEqual(buffer, fixtures['jpeg1-orig']);
      callback();
    });
  });
});
