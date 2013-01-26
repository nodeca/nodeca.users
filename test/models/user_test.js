'use strict';


/*global N, describe, it*/


var expect = require('chai').expect;


var User = N.models.users.User;


describe('User', function () {
  describe('.validateNick()', function () {
    it('should require nickname to have at least 3 chars', function () {
      expect(User.validateNick('ab')).to.equal(false);
      expect(User.validateNick('abc')).to.equal(true);
    });

    it('should allow only letters, digits, dashes and underscores', function () {
      expect(User.validateNick('o.O')).to.equal(false);
      expect(User.validateNick('-O_0-')).to.equal(true);
    });
  });

  describe('.validatePassword()', function () {
    it('should require password to have least 8 chars', function () {
      expect(User.validatePassword('abcd123')).to.equal(false);
      expect(User.validatePassword('abcd1234')).to.equal(true);
    });

    it('should require password to have at least one digit and one letter', function () {
      expect(User.validatePassword('abcdefgh')).to.equal(false);
      expect(User.validatePassword('abcdefg8')).to.equal(true);

      expect(User.validatePassword('12345678')).to.equal(false);
      expect(User.validatePassword('1234567h')).to.equal(true);
    });
  });
});
