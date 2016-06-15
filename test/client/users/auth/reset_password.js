'use strict';


const simplesmtp  = require('simplesmtp');
const randomBytes = require('crypto').randomBytes;
const co          = require('bluebird-co').co;
const Promise     = require('bluebird');


describe('Reset password', function () {
  let login    = randomBytes(10).toString('hex');
  let email    = login + '@example.com';
  let password = randomBytes(10).toString('hex') + 'Abc123';
  let user;
  let smtp;


  before(co.wrap(function* () {
    user = new TEST.N.models.users.User({
      nick: login,
      email
    });

    yield user.save();

    let authLink = new TEST.N.models.users.AuthLink({
      type: 'plain',
      email,
      user: user._id,
      ip: '127.0.0.1',
      last_ip: '127.0.0.1'
    });

    yield authLink.setPass(randomBytes(10).toString('hex') + 'Cde123');
    yield authLink.save();

    smtp = simplesmtp.createServer({ disableDNSValidation: true });

    smtp.on('startData', connection => { connection.body = ''; });
    smtp.on('data', (connection, chunk) => { connection.body += chunk; });

    yield Promise.fromCallback(cb => smtp.listen(2525, cb));
  }));


  it('should authorize after change', function (done) {
    let email_body = '';

    smtp.on('dataReady', (connection, cb) => {
      email_body = connection.body;
      cb();
    });

    function waitForEmail(cb) {
      if (email_body) {
        cb();
        return;
      }

      setTimeout(() => {
        waitForEmail(cb);
      }, 100);
    }

    TEST.browser
      // Request password
      .do.auth()
      .do.open(TEST.N.router.linkTo('users.auth.reset_password.request_show'))
      .do.fill('form[data-on-submit="users.auth.reset_password.request_exec"]', {
        email
      })
      .do.click('button[type="submit"]')
      .fn(waitForEmail)

      // Change password
      .do.open(() => {
        let url = /http:\/\/localhost:3005\/[^\s]+/.exec(email_body)[0];

        email_body = '';
        return url;
      })
      .do.fill('form[data-on-submit="users.auth.reset_password.change_exec"]', {
        password
      })
      .do.click('button[type="submit"]')
      .fn(waitForEmail)

      // Login with new password
      .do.auth()
      .do.open(TEST.N.router.linkTo('users.auth.login.show'))
      .do.fill('form[data-on-submit="users.auth.login.plain_exec"]', {
        email_or_nick: login,
        pass: password
      })
      .do.click('button[type="submit"]')
      .do.wait('.user-member-page')
      .test.url(TEST.N.router.linkTo('users.member', { user_hid: user.hid }))
      .run(true, done);
  });


  after(done => smtp.end(done));
});
