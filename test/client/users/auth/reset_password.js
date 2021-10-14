'use strict';


const assert      = require('assert');
const randomBytes = require('crypto').randomBytes;
const SMTPServer  = require('smtp-server').SMTPServer;


describe('Reset password', function () {
  let login        = randomBytes(10).toString('hex');
  let email        = login + '@example.com';
  let old_password = randomBytes(10).toString('hex') + 'Cde123';
  let new_password = randomBytes(10).toString('hex') + 'Abc123';
  let user;
  let smtp;
  let on_message;


  before(async function () {
    user = new TEST.N.models.users.User({
      nick: login,
      email
    });

    await user.save();

    let authProvider = new TEST.N.models.users.AuthProvider({
      type: 'plain',
      email,
      user: user._id,
      ip: '127.0.0.1',
      last_ip: '127.0.0.1'
    });

    await authProvider.setPass(old_password);
    await authProvider.save();

    smtp = new SMTPServer({
      authOptional: true,
      onData(stream, session, callback) {
        let data = '';
        stream.setEncoding('utf8');

        stream.on('data', d => { data += d; });
        stream.on('end', () => {
          on_message(session, data);
          callback();
        });
      }
    });

    await new Promise((resolve, reject) => {
      smtp.listen(2525, err => (err ? reject(err) : resolve()));
    });
  });


  it('should send email with password reset link', async function () {
    let get_email = new Promise(resolve => {
      on_message = (session, data) => {
        resolve(data.replace(/\=\r\n/g, ''));
      };
    });

    await TEST.browser
      // Request password
      .do.auth()
      .do.open(TEST.N.router.linkTo('users.auth.reset_password.request_show'))
      .do.fill('form[data-on-submit="users.auth.reset_password.request_exec"]', {
        email
      })
      .do.click('form[data-on-submit="users.auth.reset_password.request_exec"] button[type="submit"]')
      .close()
      .run();

    let email_body = await get_email;
    let route = TEST.N.router.match(/http:\/\/localhost:3005\/[^\s]+/.exec(email_body)[0]);

    assert.equal(route.meta.methods.get, 'users.auth.reset_password.change_show');

    let token = await TEST.N.models.users.TokenResetPassword.findOne({
      secret_key: route.params.secret_key
    });

    assert.equal(String(token.user), String(user._id));
  });


  it('should send email after password reset', async function () {
    let token;
    let get_email = new Promise(resolve => {
      on_message = (session, data) => {
        resolve(data.replace(/\=\r\n/g, ''));
      };
    });

    await TEST.browser
      // Request any page just to get session
      .do.open(() => TEST.N.router.linkTo('users.auth.login.show'))
      .get.cookies((cookies, callback) => {
        let sid = cookies.find(c => c.name === 'sid');

        TEST.N.models.users.TokenResetPassword.create({
          user: user._id,
          session_id: sid.value
        }, (err, t) => {
          if (err) {
            callback(err);
            return;
          }

          token = t;
          callback();
        });
      })
      // Change password
      .do.open(() => TEST.N.router.linkTo('users.auth.reset_password.change_show', {
        secret_key: token.secret_key
      }))
      .do.fill('form[data-on-submit="users.auth.reset_password.change_exec"]', {
        password: new_password
      })
      .do.click('form[data-on-submit="users.auth.reset_password.change_exec"] button[type="submit"]')
      .close()
      .run();

    let email_body = await get_email;

    assert(email_body.indexOf(login) !== -1);

    let authProvider = await TEST.N.models.users.AuthProvider.findOne({
      email_lc: email.toLowerCase(),
      type: 'plain',
      exists: true
    });

    assert.strictEqual(await authProvider.checkPass(new_password), true);
  });


  after(done => smtp.close(done));
});
