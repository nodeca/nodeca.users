'use strict';


const assert  = require('assert');
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
      assert.equal(User.validateNick('O_0'), true);
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
    it('"plain" provider set/check password', async function () {
      let authProvider = new TEST.N.models.users.AuthProvider();
      let pass = 'Qwerty123';

      authProvider.type = 'plain';

      await authProvider.setPass(pass);

      let ok = await authProvider.checkPass(pass);

      assert.equal(ok, true);
    });
  });
});
