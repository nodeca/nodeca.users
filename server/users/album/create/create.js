// Create album


'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    title: {
      type: 'string',
      required: true
    }
  });


  // Check auth
  // TODO: Add permissions check
  //
  N.wire.before(apiPath, function check_user_auth(env) {
    if (env.user_info.is_guest) {
      return N.io.NOT_AUTHORIZED;
    }
  });


  N.wire.on(apiPath, function create_user_album(env, callback) {
    var album = new N.models.users.Album();
    album.user_id = env.session.user_id;
    album.title = env.params.title;
    album.last_at = new Date();
    album.save(callback);
  });
};
