// Send account activation token to user's email.


'use strict';


var url = require('url');


module.exports = function sendActivationToken(N, env, email, token, callback) {
  var link;

  // Construst base link.
  link = N.runtime.router.linkTo('users.auth.register.activate', { secret_key: token.secret_key });

  // Prepend protocol and host if link not contains them.
  link = url.resolve(env.origin.req.fullUrl, link);

  N.settings.get('general_project_name', {}, function (err, projectName) {
    if (err) {
      callback(err);
      return;
    }

    N.mailer.send({
      to:      email
    , subject: env.helpers.t('users.auth.register.activation_email.subject', { project_name: projectName })
    , text:    env.helpers.t('users.auth.register.activation_email.text',    { link: link })
    }, callback);
  });
};
