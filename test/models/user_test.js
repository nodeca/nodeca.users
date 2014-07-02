'use strict';


/*global describe, it*/


var assert = require('assert');


var User = global.TEST_N.models.users.User;


describe('User', function () {
  describe('.validateNick()', function () {
    it('nickname must have at least 3 chars', function () {
      assert.equal(User.validateNick('ab'), false);
      assert.equal(User.validateNick('abc'), true);
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
  });

  describe('Auth provider', function () {
    it('"plain" provider set/check password', function (done) {
      var authLink = new global.TEST_N.models.users.AuthLink();

      authLink.type = 'plain';

      var pass = 'Qwerty123';
      authLink.setPass(pass, function (err) {
        if (err) { return done(err); }
        authLink.checkPass(pass, function (err, ok) {
          if (err) { return done(err); }
          assert.equal(ok, true);
          done();
        });
      });
    });
  });
});
