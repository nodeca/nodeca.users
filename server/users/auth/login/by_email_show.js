// Show page with message that login link was sent.


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    $query: {
      type: 'object',
      properties: {
        wrongpass: { const: '' }
      },
      required: false,
      additionalProperties: false
    }
  });

  // Kick logged-in members
  //
  N.wire.before(apiPath, function register_guest_only(env) {
    return N.wire.emit('internal:users.redirect_not_guest', env);
  });


  N.wire.on(apiPath, function login_by_email_show(env) {
    env.res.head.title = env.t('title');
    env.res.wrongpass = typeof env.params.$query?.wrongpass !== 'undefined';
  });
};
