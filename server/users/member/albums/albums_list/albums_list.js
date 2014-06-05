// Shows albums list for user by hid
'use strict';

module.exports = function (N, apiPath) {
  var Album = N.models.users.Album;

  N.validate(apiPath, {
    user_id: {
      format: 'mongo',
      required: true
    }
  });


  // Find and processes user albums
  //
  N.wire.on(apiPath, function get_user_albums(env, callback) {
    Album
      .find({ 'user_id': env.params.user_id || env.data.user._id })
      .sort('-default -last_at')
      .lean(true)
      .exec(function (err, result) {
        if (err) {
          callback(err);
          return;
        }

        env.res.albums = result;
        callback();
      });
  });
};
