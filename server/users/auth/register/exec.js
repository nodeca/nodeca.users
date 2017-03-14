// Register a new user. If email validation needed store
// reg info in TokenActivationEmail. Else save user


'use strict';


const _           = require('lodash');
const Promise     = require('bluebird');
const validator   = require('is-my-json-valid');
const email_regex = require('email-regex');
const url         = require('url');
const recaptcha   = require('nodeca.core/lib/app/recaptcha');
const password    = require('nodeca.users/models/users/_lib/password');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    // `required` specially set to false, because values are checked later
    // to show errors in regustration form.
    email: { type: 'string', required: false },
    pass:  { type: 'string', required: false },
    nick:  { type: 'string', required: false },
    'g-recaptcha-response':  { type: 'string', required: false }
  });


  // Kick off logged-in members
  //
  N.wire.before(apiPath, function register_guest_only(env) {
    return N.wire.emit('internal:users.redirect_not_guest', env);
  });


  // Create sandbox for form errors
  //
  N.wire.before(apiPath, function prepare_env_data(env) {
    env.data.errors = env.data.errors || {};
  });


  // Form input validator
  const validate = validator({
    type: 'object',
    properties: {
      email: { format: 'email', required: true },
      pass:  { format: 'pass',  required: true },
      nick:  { format: 'nick',  required: true }
    }
  }, {
    verbose: true,
    formats: {
      pass:  N.models.users.User.validatePassword,
      nick:  N.models.users.User.validateNick,
      email: email_regex({ exact: true })
    }
  });


  // Validate form data
  //
  N.wire.before(apiPath, function validate_params(env) {
    if (!validate(env.params)) {
      _.forEach(validate.errors, function (error) {
        // Don't customize form text, just highlight the field.
        env.data.errors[error.field.replace(/^data[.]/, '')] = null;
      });

      // terminate
      throw {
        code: N.io.CLIENT_ERROR,
        data: env.data.errors
      };
    }
  });


  // Check email uniqueness. User email and oauth provider email should be unique
  //
  N.wire.before(apiPath, function* check_email_uniqueness(env) {

    if (yield N.models.users.AuthLink.similarEmailExists(env.params.email)) {
      env.data.errors.email = env.t('err_busy_email');
      return;
    }

    // If we use oauth for registration, provider email should be unique too.
    if (env.session.oauth && env.session.oauth.info) {
      if (yield N.models.users.AuthLink.similarEmailExists(env.session.oauth.info.email)) {
        env.data.errors.email = env.t('err_busy_email');
        return;
      }
    }
  });


  // Check nick uniqueness
  //
  N.wire.before(apiPath, function* check_nick_uniqueness(env) {
    if (yield N.models.users.User.similarExists(env.params.nick)) {
      env.data.errors.nick = env.t('err_busy_nick');
    }
  });


  // Additional checks for password
  //
  N.wire.before(apiPath, function check_password(env) {
    // forbid password equal to user nickname
    if (env.params.pass.toLowerCase() === env.params.nick.toLowerCase()) {
      env.data.errors.pass = env.t('err_password_is_nick');
      return;
    }

    // forbid password equal to user email address
    if (env.params.pass.toLowerCase() === env.params.email.toLowerCase()) {
      env.data.errors.pass = env.t('err_password_is_email');
      return;
    }

    // forbid password equal to hostname
    let mount = _.get(N.config, 'bind.default.mount');

    if (mount) {
      if (env.params.pass.toLowerCase() === url.parse(mount).hostname.toLowerCase()) {
        env.data.errors.pass = env.t('err_password_is_hostname');
        return;
      }
    }
  });


  // Check recaptcha
  //
  N.wire.before(apiPath, function* validate_recaptcha(env) {
    if (!N.config.options.recaptcha) return;

    // Skip if some other fields are incorrect in order to not change
    // captcha words and not annoy the user by forcing him to retype.
    if (!_.isEmpty(env.data.errors)) return;

    let privateKey = N.config.options.recaptcha.private_key,
        clientIp   = env.req.ip,
        response   = env.params['g-recaptcha-response'];

    let valid = yield recaptcha.verify(privateKey, clientIp, response);

    if (!valid) {
      env.data.errors.recaptcha_response_field = env.t('err_wrong_captcha');
    }
  });


  // If previos checks failed terminate with client error
  //
  N.wire.before(apiPath, function check_errors(env) {
    if (!_.isEmpty(env.data.errors)) {
      throw { code: N.io.CLIENT_ERROR, data: env.data.errors };
    }
  });


  // Check if need email validation step or should create user directly
  //
  N.wire.before(apiPath, function* check_need_validation(env) {
    let validate_email = yield N.settings.get('validate_email');

    env.data.validate_email = validate_email;

    // If global setting disables validation - skip next checks.
    if (!validate_email) return;

    // If oauth login info exists, skip validation for trusted provider,
    // when user's email === privider's email
    let oainfo = (env.session.oauth || {}).info;

    if (oainfo && N.config.oauth[oainfo.type].trusted && env.params.email === oainfo.email) {
      env.data.validate_email = false;
    }
  });


  //////////////////////////////////////////////////////////////////////////////
  // Helpers

  // Create user record and login
  //
  let create_user = Promise.coroutine(function* create_user(env) {
    yield N.wire.emit('internal:users.user_create', env);

    // authLink info is needed to create TokenLogin
    //
    // TODO: when we will have oauth registration, it should select link based on
    //       env.data.oauth_info
    //
    env.data.authLink = yield N.models.users.AuthLink.findOne({ user: env.data.user._id });

    yield N.wire.emit('internal:users.login', env);

    env.res.redirect_url = env.data.redirect_url;
  });


  // If the user have to confirm email, create token and send it by email.
  //
  let send_activation = Promise.coroutine(function* send_activation(env) {
    let token = yield N.models.users.TokenActivationEmail.create({
      ip: env.req.ip,
      reg_info: env.data.reg_info,
      oauth_info: env.data.oauth_info
    });

    env.res.redirect_url = N.router.linkTo('users.auth.register.activate_show');

    let link = env.helpers.link_to('users.auth.register.activate_exec', {
      secret_key: token.secret_key
    });

    let general_project_name = yield N.settings.get('general_project_name');

    yield N.mailer.send({
      to:         env.data.reg_info.email,
      subject:    env.t('email_subject', { project_name: general_project_name }),
      text:       env.t('email_text',    {
        project_name: general_project_name,
        nick:         env.params.nick,
        link
      }),
      safe_error: true
    });
  });

  //////////////////////////////////////////////////////////////////////////////


  // If user need to activate email, create token and send activation email.
  // Else create user immediately.
  //
  N.wire.on(apiPath, function* finish_registration(env) {

    env.data.reg_info = {
      nick:      env.params.nick,
      email:     env.params.email,
      pass_hash: yield password.hash(env.params.pass)
    };

    env.data.oauth_info = (env.session.oauth || {}).info;

    // Stupid attempt to cleanup session. It should be safe to skip it,
    // because session is deleted on user login.
    env.session = _.omit(env.session, [ 'oauth' ]);

    if (env.data.validate_email) {
      yield send_activation(env);
      return;
    }

    yield create_user(env);
  });
};
