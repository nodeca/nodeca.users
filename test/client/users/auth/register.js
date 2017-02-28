'use strict';


const assert      = require('assert');
const Promise     = require('bluebird');
const randomBytes = require('crypto').randomBytes;
const simplesmtp  = require('simplesmtp');
const password    = require('nodeca.users/models/users/_lib/password');


describe('Register', function () {
  let smtp;


  before(function (done) {
    smtp = simplesmtp.createServer({ disableDNSValidation: true });

    smtp.on('startData', connection => { connection.body = ''; });
    smtp.on('data', (connection, chunk) => { connection.body += chunk; });

    smtp.listen(2525, done);
  });

  it('should send confirmation link via email', Promise.coroutine(function* () {
    let login    = randomBytes(10).toString('hex');
    let email    = login + '@example.com';
    let pass     = randomBytes(10).toString('hex') + 'Abc123';

    let get_email = new Promise(resolve => {
      smtp.once('dataReady', (connection, cb) => {
        cb();
        resolve(connection.body.replace(/\=\r\n/g, ''));
      });
    });

    yield TEST.browser
      // Register user
      .do.auth()
      .do.open(TEST.N.router.linkTo('users.auth.register.show'))
      .wait(500)
      .do.fill('form[data-on-submit="users.auth.register.exec"]', {
        email,
        pass,
        nick: login
      })
      .do.click('form[data-on-submit="users.auth.register.exec"] button[type="submit"]')
      .close()
      .run();

    let email_body = yield get_email;
    let route = TEST.N.router.match(/http:\/\/localhost:3005\/[^\s]+/.exec(email_body)[0]);

    assert.equal(route.meta.methods.get, 'users.auth.register.activate_exec');

    let token = yield TEST.N.models.users.TokenActivationEmail.findOne({
      secret_key: route.params.secret_key
    });

    assert.equal(token.reg_info.nick, login);
    assert.equal(token.reg_info.email, email);
  }));


  it('should authorize via confirmation link', Promise.coroutine(function* () {
    let login = randomBytes(10).toString('hex');
    let pass  = randomBytes(10).toString('hex') + 'Abc123';
    let token = yield TEST.N.models.users.TokenActivationEmail.create({
      ip: '127.0.0.1',
      reg_info: {
        pass_hash: password.hash(pass),
        email:     login + '@example.com',
        nick:      login
      }
    });

    yield TEST.browser
      // Confirm account
      .do.open(() => TEST.N.router.linkTo('users.auth.register.activate_exec', {
        secret_key: token.secret_key
      }))
      .test.url(TEST.N.router.linkTo('users.auth.register.activate_done'))
      .close()
      .run();
  }));


  after(done => smtp.end(done));
});
