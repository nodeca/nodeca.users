// Create video to album

'use strict';

var _ = require('lodash');

module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    album_id: {
      format: 'mongo',
      required: true
    },
    media_url: {
      type: 'string',
      required: true
    }
  });


  // Fetch album info (by album_id)
  //
  N.wire.before(apiPath, function fetch_album(env, callback) {
    N.models.users.Album
      .findOne({ '_id': env.params.album_id })
      .lean(true)
      .exec(function (err, album) {
        if (err) {
          callback(err);
          return;
        }

        if (!album) {
          callback(N.io.NOT_FOUND);
          return;
        }

        env.data.album = album;
        callback();
      });
  });


  // Check is current user owner of album
  //
  N.wire.before(apiPath, function check_permissions(env) {
    if (!env.session.user_id || env.session.user_id.toString() !== env.data.album.user_id.toString()) {
      return N.io.FORBIDDEN;
    }
  });


  // Create media by media_url
  //
  N.wire.on(apiPath, function create_media(env, callback) {
    var url = env.params.media_url;
    var providers;

    // Get available for media providers
    if (N.config.medialinks.albums === true) {
      providers = N.config.medialinks.providers;
    } else {
      providers = _.filter(N.config.medialinks.providers, function (provider, providerName) {
        return N.config.medialinks.albums.indexOf(providerName) !== -1;
      });
    }

    // Find provider by url
    var provider = _.find(providers, function (provider) {
      for (var i = 0; i < provider.match.length; i++) {
        if (provider.match[i].test(url)) {
          return true;
        }
      }
      return false;
    });

    if (!provider) {
      callback({ code: N.io.CLIENT_ERROR, message: env.t('err_invalid_url') });
      return;
    }

    provider.fetch(url, function (err, data) {
      if (err) {
        callback({ code: N.io.CLIENT_ERROR, message: env.t('err_cannot_parse') });
        return;
      }

      var media = new N.models.users.Media();
      media.medialink_html = _.template(provider.template, data);
      media.medialink_data = data;
      media.user_id = env.data.album.user_id;
      media.album_id = env.data.album._id;
      media.type = 'medialink';
      media.save(callback);
    });
  });


  // Update album info
  //
  N.wire.after(apiPath, function update_album_info(env, callback) {
    N.models.users.Album.updateInfo(env.data.album._id, function (err) {
      if (err) {
        callback(err);
        return;
      }

      callback();
    });
  });
};
