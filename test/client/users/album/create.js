/*global $, assert, trigger*/

'use strict';

describe('Albums create dialog', function () {
  this.timeout(20000);

  it('should create new album', function (done) {
    var user;

    TEST.browser
      // Authorize
      .auth('users_album_create', function (usr) {
        user = usr;
      })

      // Navigate to albums page
      .goto(function () {
        return TEST.N.router.linkTo('users.albums_root', { user_hid: user.hid });
      })

      .evaluateAsync(function (done) {
        TEST.N.wire.once('users.album.create:shown', { priority: 999 }, function () {
          $('input[name="album_name"]').val('new test album!');
          $('.modal-dialog button[type="submit"]').click();
        });

        trigger('[data-on-click="users.albums_root.create_album"]', function () {
          assert.equal($('.user-albumlist li:last .thumb-caption__line:first').text(), 'new test album!');
          done();
        });
      })

      // Run test
      .run(done);
  });
});
