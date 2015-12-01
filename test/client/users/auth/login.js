'use strict';


var randomBytes = require('crypto').randomBytes;


describe('Login', function () {
  var login = randomBytes(10).toString('hex');
  var email = login + '@example.com';
  var password = randomBytes(10).toString('hex') + 'Abc123';
  var user;


  // Create new user
  //
  before(function (callback) {
    user = new TEST.N.models.users.User({
      nick: login
    });

    user.save(function (err) {
      if (err) {
        callback(err);
        return;
      }

      var authLink = new TEST.N.models.users.AuthLink();

      authLink.type = 'plain';
      authLink.email = email;

      authLink.setPass(password, function (err) {
        if (err) {
          callback(err);
          return;
        }

        authLink.user_id = user._id;
        authLink.ip = '127.0.0.1';
        authLink.last_ip = '127.0.0.1';

        authLink.save(callback);
      });
    });
  });


  it('should redirect to member page if auth page opened by direct url', function (callback) {
    TEST.browser
      .do.auth()
      .do.open(TEST.N.router.linkTo('users.auth.login.show'))
      .do.type('#login_email_or_nick', login)
      .do.type('#login_pass', password)
      .do.click('button[type="submit"]')
      .do.wait('.user-member-page')
      .test.url(TEST.N.router.linkTo('users.member', { user_hid: user.hid }))
      .run(true, callback);
  });


  it('should redirect to previous page', function (callback) {
    TEST.browser
      .do.auth()
      .do.open(TEST.N.router.linkTo('users.albums_root', { user_hid: user.hid }))
      .do.click('li[data-api-path="users.auth.login"] a')
      .do.wait('#login_email_or_nick')
      .do.type('#login_email_or_nick', login)
      .do.type('#login_pass', password)
      .do.click('button[type="submit"]')
      .do.wait('.user-albumlist')
      .test.url(TEST.N.router.linkTo('users.albums_root', { user_hid: user.hid }))
      .run(true, callback);
  });


  it('should follow by redirect id', function (callback) {
    TEST.browser
      .do.auth()
      .do.open(TEST.N.router.linkTo('users.tracker'))
      .do.wait('#login_email_or_nick')
      .do.type('#login_email_or_nick', login)
      .do.type('#login_pass', password)
      .do.click('button[type="submit"]')
      .do.wait('.user-tracker')
      .test.url(TEST.N.router.linkTo('users.tracker'))
      .run(true, callback);
  });
});
