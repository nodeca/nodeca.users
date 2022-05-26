'use strict';


const assert      = require('assert');
const check_title = require('nodeca.users/lib/check_title');


describe('check_title', function () {
  describe('normalize_title', function () {
    const normalize = check_title.normalize_title;

    it('should trim spaces', function () {
      assert.strictEqual(normalize('  foo  bar  '), 'foo  bar');
    });

    it('should replace multiple ending punct', function () {
      assert.strictEqual(normalize('  foo !!! bar !!! '), 'foo !!! bar !');
      assert.strictEqual(normalize('  foo ??? bar ??? '), 'foo ??? bar ?');
    });

    it('should lowercase in case of too many caps', function () {
      assert.strictEqual(normalize('HELLO world'), 'hello world');
      assert.strictEqual(normalize('Hello WORLD'), 'hello world');
      assert.strictEqual(normalize('HELLo world'), 'HELLo world');
      assert.strictEqual(normalize('Hello World 123456'), 'Hello World 123456');
    });
  });


  describe('has_emoji', function () {
    const has_emoji = check_title.has_emoji;

    it('should detect emoji', function () {
      assert.strictEqual(has_emoji('hello😀world'), true);
      assert.strictEqual(has_emoji('hello|world'), false);
    });
  });
});
