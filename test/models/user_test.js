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
});
