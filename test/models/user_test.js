'use strict';


/*global nodeca, describe, it*/


var User = nodeca.models.users.User;


describe('User', function () {
  describe('.validateNick()', function () {
    it('should require nick to be at least 3 chars', function () {
      User.validateNick('ab').should.equal(false);
      User.validateNick('abc').should.equal(true);
    });

    it('should allow only letters, digits, dashes and underscores', function () {
      User.validateNick('o.O').should.equal(false);
      User.validateNick('-O_0-').should.equal(true);
    });
  });

  describe('.validatePassword()', function () {
    it('should require password to be at least 8 characters', function () {
      User.validatePassword('abcd123').should.equal(false);
      User.validatePassword('abcd1234').should.equal(true);
    });

    it('should require password to have at least one digit and one letter', function () {
      User.validatePassword('abcdefgh').should.equal(false);
      User.validatePassword('abcdefg8').should.equal(true);

      User.validatePassword('12345678').should.equal(false);
      User.validatePassword('1234567h').should.equal(true);
    });
  });
});
