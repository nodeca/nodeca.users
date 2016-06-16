'use strict';


const randomBytes = require('crypto').randomBytes;
const co          = require('bluebird-co').co;


describe('Login', function () {
  let login = randomBytes(10).toString('hex');
  let email = login + '@example.com';
  let password = randomBytes(10).toString('hex') + 'Abc123';
  let user;


  // Create new user
  //
  before(co.wrap(function* () {
    user = new TEST.N.models.users.User({
      nick: login
    });

    yield user.save();

    let authLink = new TEST.N.models.users.AuthLink();

    authLink.type = 'plain';
    authLink.email = email;
    yield authLink.setPass(password);
    authLink.user = user._id;
    authLink.ip = '127.0.0.1';
    authLink.last_ip = '127.0.0.1';
    yield authLink.save();
  }));


  it('should redirect to member page if auth page opened by direct url', function (done) {
    TEST.browser
      .do.auth()
      .do.open(TEST.N.router.linkTo('users.auth.login.show'))
      .do.fill('form[data-on-submit="users.auth.login.plain_exec"]', {
        email_or_nick: login,
        pass: password
      })
      .do.click('button[type="submit"]')
      .do.wait('.user-member-page')
      .test.url(TEST.N.router.linkTo('users.member', { user_hid: user.hid }))
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
      .do.click('button[type="submit"]')
      .do.wait('.user-albumlist')
      .test.url(TEST.N.router.linkTo('users.albums_root', { user_hid: user.hid }))
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
      .do.click('button[type="submit"]')
      .do.wait('.user-tracker')
      .test.url(TEST.N.router.linkTo('users.tracker'))
      .run(done);
  });
});
