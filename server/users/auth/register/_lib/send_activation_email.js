// Send account activation token to user's email.


'use strict';


module.exports = function sendActivationEmail(N, env, email, token, callback) {
  var link = env.helpers.url_to('users.auth.register.activate_show', {
    secret_key: token.secret_key
  });

  N.settings.get('general_project_name', function (err, projectName) {
    if (err) {
      callback(err);
      return;
    }

    N.mailer.send({
      to:      email
    , subject: env.t('@users.auth.register.activation_email.subject', { project_name: projectName })
    , text:    env.t('@users.auth.register.activation_email.text',    { link: link })
    }, callback);
  });
};
