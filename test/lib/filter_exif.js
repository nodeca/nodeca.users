'use strict';


const assert      = require('assert');
const fs          = require('fs');
const glob        = require('glob').sync;
const path        = require('path');
const filter_exif = require('nodeca.users/lib/filter_exif');


function addTestBlock(Buffer) {
  let fixtures = {};
  let cwd = path.join(__dirname, 'fixtures');

  glob('*.exif.txt', { cwd })
    .filter(name => !/^[._]|\\[._]|\/[_.]/.test(name))
    .forEach(name => {
      let hex = fs.readFileSync(path.join(cwd, name), 'utf8').replace(/;.*/mg, '');
      let buf = new Buffer(hex.match(/[0-9a-f]{2}/gi).map(i => parseInt(i, 16)));

      fixtures[name.replace(/\.exif\.txt$/, '')] = buf;
    });

  it('should remove thumbnail', function () {
    assert.deepEqual(filter_exif(fixtures['exif1-orig']), fixtures['exif1-nothumb']);
  });

  it('should remove thumbnail #2', function () {
    assert.deepEqual(filter_exif(fixtures['exif2-orig']), fixtures['exif2-nothumb']);
  });

  it('should remove large entries #1', function () {
    assert.deepEqual(
      filter_exif(fixtures['exif1-orig'], {
        maxEntrySize: 20
      }),
      fixtures['exif1-nothumb']);
  });

  it('should remove large entries #2', function () {
    assert.deepEqual(
      filter_exif(fixtures['exif1-orig'], {
        maxEntrySize: 19
      }),
      fixtures['exif1-nolarge']);
  });

  it('should not throw stuff if tiff is incomplete', function () {
    // only acceptable error here is EBADDATA
    for (let i = 6; i < fixtures['exif1-orig'].length; i++) {
      try {
        filter_exif(fixtures['exif1-orig'].slice(0, i), { exifMaxEntrySize: 10 });
      } catch (err) {
        if (err.code !== 'EBADDATA') throw err;
      }
    }
  });
}


describe('filter_exif (Buffer)', function () {
  addTestBlock(Buffer);
});


describe('filter_exif (Uint8Array)', function () {
  addTestBlock(Uint8Array);
});
