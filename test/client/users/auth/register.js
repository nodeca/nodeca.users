'use strict';


const simplesmtp  = require('simplesmtp');
const randomBytes = require('crypto').randomBytes;


describe('Register', function () {
  let login    = randomBytes(10).toString('hex');
  let email    = login + '@example.com';
  let password = randomBytes(10).toString('hex') + 'Abc123';
  let smtp;


  before(function (done) {
    smtp = simplesmtp.createServer({ disableDNSValidation: true });

    smtp.on('startData', connection => { connection.body = ''; });
    smtp.on('data', (connection, chunk) => { connection.body += chunk; });

    smtp.listen(2525, done);
  });


  it('should authorize via confirmation link', function (done) {
    let email_body = '';

    smtp.on('dataReady', (connection, cb) => {
      email_body = connection.body.replace(/\=\r\n/g, '');
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
      // Register user
      .do.auth()
      .do.open(TEST.N.router.linkTo('users.auth.register.show'))
      .do.fill('form[data-on-submit="users.auth.register.exec"]', {
        email,
        pass: password,
        nick: login
      })
      .do.click('button[type="submit"]')
      .fn(waitForEmail)

      // Confirm account
      .do.open(() => /http:\/\/localhost:3005\/[^\s]+/.exec(email_body)[0])
      .test.url(TEST.N.router.linkTo('users.auth.register.activate_done'))
      .run(true, done);
  });


  after(done => smtp.end(done));
});
