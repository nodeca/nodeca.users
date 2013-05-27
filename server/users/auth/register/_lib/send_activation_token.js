// Create new account activation token for the given email address and
// send it by a letter.


'use strict';


var url = require('url');


module.exports = function sendActivationToken(N, env, email, callback) {
  N.models.users.TokenActivationEmail.create({ email: email }, function (err, token) {
    if (err) {
      callback(err);
      return;
    }

    var link;

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
      , subject: env.helpers.t('users.auth.register.letter.subject', { project_name: projectName })
      , text:    env.helpers.t('users.auth.register.letter.text',    { link: link })
      }, callback);
    });
  });
};
