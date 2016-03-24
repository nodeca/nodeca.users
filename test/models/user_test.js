'use strict';


const assert = require('assert');
const co     = require('bluebird-co').co;
const User   = TEST.N.models.users.User;


describe('User', function () {
  describe('.validateNick()', function () {
    it('nickname must have at least 3 chars', function () {
      assert.equal(User.validateNick('ab'), false);
      assert.equal(User.validateNick('abc'), true);
      assert.equal(User.validateNick('фыв'), true);
    });

    it('allow only letters, digits, dashes and underscores', function () {
      assert.equal(User.validateNick('o.O'), false);
      assert.equal(User.validateNick('-O_0-'), true);
    });
  });

  describe('.validatePassword()', function () {
    it('password must have least 8 chars', function () {
      assert.equal(User.validatePassword('abcd123'), false);
      assert.equal(User.validatePassword('abcd1234'), true);
    });

    it('password must have at least one digit and one letter', function () {
      assert.equal(User.validatePassword('abcdefgh'), false);
      assert.equal(User.validatePassword('abcdefg8'), true);

      assert.equal(User.validatePassword('12345678'), false);
      assert.equal(User.validatePassword('1234567h'), true);
    });

    it('password must allow international chars', function () {
      assert.equal(User.validatePassword('фыва1234'), true);
    });
  });

  describe('Auth provider', function () {
    it('"plain" provider set/check password', co.wrap(function* () {
      let authLink = new TEST.N.models.users.AuthLink();
      let pass = 'Qwerty123';

      authLink.type = 'plain';

      yield authLink.setPass(pass);

      let ok = yield authLink.checkPass(pass);

      assert.equal(ok, true);
    }));
  });
});
