// Show 'Enter new password' page or error on invalid token.


'use strict';

const crypto = require('crypto');


function get_short_code(length = 6) {
  return (crypto.randomBytes(4).readUInt32BE(0) + 10 ** (length + 1)).toString(10).slice(-length);
}


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    secret_key: { type: 'string', required: true }
  });


  // Check token
  //
  N.wire.before(apiPath, async function check_token(env) {
    if (env.res.error) return;

    let token = await N.models.users.TokenResetPassword.findOne()
                          .where('secret_key').equals(env.params.secret_key)
                          .lean(true)
                          .exec();

    if (!token) {
      env.res.error = env.t('err_invalid_token');
      return;
    }

    env.data.token = token;
  });


  // Generate code from a different browser
  //
  N.wire.on(apiPath, async function generate_short_code(env) {
    env.res.head.title = env.t('title');

    if (env.res.error) return;

    if (env.session_id && env.session_id === env.data.token.session_id) {
      // same browser, show change password form
      env.res.secret_key = env.params.secret_key;
      return;
    }

    if (env.data.token.short_code) {
      // user opens email link in two different browsers, show code generated in first one
      env.res.short_code = env.data.token.short_code;
      return;
    }

    env.res.short_code = get_short_code();

    await N.models.users.TokenResetPassword.updateOne(
      { _id: env.data.token._id },
      { $set: {
        short_code: env.res.short_code,
        open_link_ts: new Date()
      } }
    );
  });
};
