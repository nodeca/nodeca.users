/*global document*/

'use strict';

describe('Albums create dialog', function () {
  it('should create new album', function (done) {
    var user;
    var paramsStack = [];

    TEST.browser
      // Authorize
      .do.auth('users_album_create', function (usr) {
        user = usr;
      })

      // Navigate to albums page
      .do.open(function () {
        return TEST.N.router.linkTo('users.albums_root', { user_hid: user.hid });
      })

      // Get albums count before create new
      .get.count('.user-albumlist li', paramsStack)

      // Click "+"
      .do.click('[data-on-click="users.albums_root.create_album"]')

      // Wait for dialog
      .do.wait('.modal.fade.in')

      // Type album's name
      .do.type('input[name="album_name"]', 'new test album!')

      // Click "OK"
      .do.click('.modal-dialog button[type="submit"]')

      // Wait page update
      .do.wait(function (paramsStack) {
        return document.querySelectorAll('.user-albumlist li').length === paramsStack[0] + 1;
      }, paramsStack)

      // Check that album created
      .test.text('.user-albumlist li:last-child .thumb-caption__line:first-child', 'new test album!')

      // Run test
      .run(true, done);
  });
});
