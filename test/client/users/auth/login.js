'use strict';


const randomBytes = require('crypto').randomBytes;
const Promise     = require('bluebird');


describe('Login', function () {
  let login = randomBytes(10).toString('hex');
  let email = login + '@example.com';
  let password = randomBytes(10).toString('hex') + 'Abc123';
  let user;


  // Create new user
  //
  before(Promise.coroutine(function* () {
    user = new TEST.N.models.users.User({
      nick: login
    });

    yield user.save();

    let authProvider = new TEST.N.models.users.AuthProvider();

    authProvider.type = 'plain';
    authProvider.email = email;
    yield authProvider.setPass(password);
    authProvider.user = user._id;
    authProvider.ip = '127.0.0.1';
    authProvider.last_ip = '127.0.0.1';
    yield authProvider.save();
  }));


  it('should redirect to member page if auth page opened by direct url', function (done) {
    TEST.browser
      .do.auth()
      .do.open(TEST.N.router.linkTo('users.auth.login.show'))
      .do.fill('form[data-on-submit="users.auth.login.plain_exec"]', {
        email_or_nick: login,
        pass: password
      })
      .do.click('form[data-on-submit="users.auth.login.plain_exec"] button[type="submit"]')
      .do.wait('.user-member-page')
      .test.url(TEST.N.router.linkTo('users.member', { user_hid: user.hid }))
      .close()
      .run(done);
  });


  it('should redirect to previous page', function (done) {
    TEST.browser
      .do.auth()
      .do.open(TEST.N.router.linkTo('users.albums_root', { user_hid: user.hid }))
      .do.click('li[data-api-path="users.auth.login"] a')
      .do.wait('form[data-on-submit="users.auth.login.plain_exec"]')
      .do.fill('form[data-on-submit="users.auth.login.plain_exec"]', {
        email_or_nick: login,
        pass: password
      })
      .do.click('form[data-on-submit="users.auth.login.plain_exec"] button[type="submit"]')
      .do.wait('.user-albumlist')
      .test.url(TEST.N.router.linkTo('users.albums_root', { user_hid: user.hid }))
      .close()
      .run(done);
  });


  it('should follow by redirect id', function (done) {
    TEST.browser
      .do.auth()
      .do.open(TEST.N.router.linkTo('users.tracker'))
      .do.wait('form[data-on-submit="users.auth.login.plain_exec"]')
      .do.fill('form[data-on-submit="users.auth.login.plain_exec"]', {
        email_or_nick: login,
        pass: password
      })
      .do.click('form[data-on-submit="users.auth.login.plain_exec"] button[type="submit"]')
      .do.wait('.user-tracker')
      .test.url(TEST.N.router.linkTo('users.tracker'))
      .close()
      .run(done);
  });
});
