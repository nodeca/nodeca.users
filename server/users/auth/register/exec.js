// Register a new user. If email validation needed store
// reg info in TokenActivationEmail. Else save user


'use strict';


const co          = require('bluebird-co').co;
const _           = require('lodash');
const validator   = require('is-my-json-valid');
const recaptcha   = require('nodeca.core/lib/recaptcha.js');


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
      pass: N.models.users.User.validatePassword,
      nick: N.models.users.User.validateNick
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

    let emails = [ env.params.email ];

    // If we use oauth for registration, provider email should be unique too.
    if (env.session.oauth && env.session.oauth.info) {
      emails.push(env.session.oauth.info.email);
    }

    let id = yield N.models.users.AuthLink
                      .findOne({ exists: true })
                      .where('email').in(emails)
                      .select('_id')
                      .lean(true);

    if (id) {
      env.data.errors.email = env.t('err_busy_email');
    }
  });


  // Check nick uniqueness
  //
  N.wire.before(apiPath, function* check_nick_uniqueness(env) {
    let user = yield N.models.users.User
                        .findOne({ nick: env.params.nick })
                        .select('_id')
                        .lean(true);

    if (user) {
      env.data.errors.nick = env.t('err_busy_nick');
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
  let create_user = co.wrap(function* create_user(env) {
    yield N.wire.emit('internal:users.user_create', env);

    // authLink info is needed to create TokenLogin
    //
    // TODO: when we will have oauth registration, it should select link based on
    //       env.data.oauth_info
    //
    env.data.authLink = yield N.models.users.AuthLink.findOne({ user_id: env.data.user._id });

    yield N.wire.emit('internal:users.login', env);

    env.res.redirect_url = env.data.redirect_url;
  });


  // If the user have to confirm email, create token and send it by email.
  //
  let send_activation = co.wrap(function* send_activation(env) {
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
      to:      env.data.reg_info.email,
      subject: env.t('email_subject', { project_name: general_project_name }),
      text:    env.t('email_text',    { link })
    });
  });

  //////////////////////////////////////////////////////////////////////////////


  // If user need to activate email, create token and send activation email.
  // Else create user immediately.
  //
  N.wire.on(apiPath, function* finish_registration(env) {

    env.data.reg_info = {
      nick: env.params.nick,
      email: env.params.email,
      pass: env.params.pass
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
