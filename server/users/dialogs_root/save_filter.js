// Save dialog filter settings
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    hide_answered: { format: 'boolean', required: true }
  });


  // Check auth
  //
  N.wire.before(apiPath, function check_auth(env) {
    if (env.user_info.is_guest) throw N.io.FORBIDDEN;
  });


  // Store setting if specified, fetch it otherwise
  //
  N.wire.on(apiPath, function* save_filter(env) {
    let store = N.settings.getStore('user');

    yield store.set({
      dialogs_hide_answered: { value: env.params.hide_answered }
    }, { user_id: env.user_info.user_id });
  });
};
