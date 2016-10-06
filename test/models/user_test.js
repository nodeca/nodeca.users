'use strict';


const assert  = require('assert');
const Promise = require('bluebird');
const User    = TEST.N.models.users.User;


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
    it('should not accept weak passwords', function () {
      assert.equal(User.validatePassword('password'), false);
      assert.equal(User.validatePassword('1234567890'), false);
      assert.equal(User.validatePassword('W3tjMcLf3i'), true);
    });
  });

  describe('Auth provider', function () {
    it('"plain" provider set/check password', Promise.coroutine(function* () {
      let authLink = new TEST.N.models.users.AuthLink();
      let pass = 'Qwerty123';

      authLink.type = 'plain';

      yield authLink.setPass(pass);

      let ok = yield authLink.checkPass(pass);

      assert.equal(ok, true);
    }));
  });
});
