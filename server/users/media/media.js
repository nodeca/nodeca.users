// Render media page


'use strict';


// comment statuses
var commentStatuses = require('../_lib/statuses.js');
var fields = require('./_fields.js');


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: { type: 'integer', minimum: 1, required: true },
    media_id: { format: 'mongo', required: true }
  });


  // shortcuts
  var Comment = N.models.users.Comment;


  // Fetch owner by hid
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env, callback) {
    N.wire.emit('internal:users.fetch_user_by_hid', env, callback);
  });


  // Fetch media
  //
  N.wire.before(apiPath, function fetch_media(env, callback) {
    var deletedTypes = N.models.users.MediaInfo.types.LIST_DELETED;

    N.models.users.MediaInfo
      .findOne({ media_id: env.params.media_id })
      .where({ user_id: env.data.user._id }) // Make sure that user is real owner
      .lean(true)
      .exec(function (err, result) {
        if (err) {
          callback(err);
          return;
        }

        if (!result) {
          callback(N.io.NOT_FOUND);
          return;
        }

        if (deletedTypes.indexOf(result.type) !== -1 && env.user_info.user_id !== String(result.user_id)) {
          callback(N.io.NOT_FOUND);
          return;
        }

        env.data.media = result;
        callback();
      });
  });


  // Prepare list of visible comments statuses depending on user permissions
  //
  N.wire.before(apiPath, function define_visible_statuses(env, callback) {

    env.extras.settings.fetch([ 'can_see_hellbanned' ], function (err, settings) {

      if (err) {
        callback(err);
        return;
      }

      env.data.statuses = [ commentStatuses.comment.VISIBLE ];
      var st = env.data.statuses;

      // if user can see HB post than can see HB content
      if (settings.can_see_hellbanned || env.user_info.hb) {
        st.push(commentStatuses.comment.HB);
      }
      callback();
    });
  });


  // Fetch album
  //
  N.wire.before(apiPath, function fetch_media(env, callback) {
    N.models.users.Album
      .findOne({ '_id': env.data.media.album_id })
      .where({ 'user_id': env.data.user._id })//Make sure that user is real owner
      .lean(true)
      .exec(function (err, result) {
        if (err) {
          callback(err);
          return;
        }
        // That should never happen
        if (!result) {
          callback(N.io.NOT_FOUND);
          return;
        }

        result.title = result.title || env.t('default_name');
        env.data.album = result;
        callback();
      });
  });


  // Prepare comments and medias
  //
  N.wire.on(apiPath, function prepare_comment(env, callback) {
    env.res.media = env.data.media;
    env.res.user_hid = env.data.user.hid;

    N.models.users.Comment
      .find({ 'media_id': env.data.media.media_id }, fields.post_in.join(' '))
      .where('st').in(env.data.statuses)
      .lean(true)
      .exec(function (err, result) {
        if (err) {
          callback(err);
          return;
        }

        if (!result) {
          callback(N.io.NOT_FOUND);
          return;
        }

        env.data.comments = result;
        callback();
      });
  });


  // Add comments into response & collect user ids
  //
  N.wire.after(apiPath, function build_comments_list_and_users(env, callback) {

    env.res.comments = env.data.comments;

    env.data.users = env.data.users || [];

    // collect users
    env.data.comments.forEach(function (comment) {
      if (comment.user_id) {
        env.data.users.push(comment.user_id);
      }
    });

    callback();
  });


  // Sanitize response info. We should not show hellbanned status to users
  // that cannot view hellbanned content.
  //
  N.wire.after(apiPath, function sanitize_statuses(env, callback) {

    env.extras.settings.fetch([ 'can_see_hellbanned' ], function (err, settings) {
      if (err) {
        callback(err);
        return;
      }

      //sanitize commets statuses
      var comments = env.res.comments;
      comments.forEach(function (comment) {
        Comment.sanitize(comment, {
          keep_statuses: settings.can_see_hellbanned
        });
      });

      callback();
    });
  });


  // Fill previous media _id
  //
  N.wire.after(apiPath, function fill_previous(env, callback) {
    var mTypes = N.models.users.MediaInfo.types;
    var media = env.data.media;

    N.models.users.MediaInfo
      .findOne({
        album_id: media.album_id,
        type: { $in: mTypes.LIST_VISIBLE },
        media_id: { $gt: media.media_id }
      })
      .select('media_id')
      .sort('media_id')
      .lean(true)
      .exec(function (err, result) {
        if (err) {
          callback(err);
          return;
        }

        if (result) {
          env.res.previous = result.media_id;
        }
        callback();
      });
  });


  // Fill next media _id
  //
  N.wire.after(apiPath, function fill_next(env, callback) {
    var mTypes = N.models.users.MediaInfo.types;
    var media = env.data.media;

    N.models.users.MediaInfo
      .findOne({
        album_id: media.album_id,
        type: { $in: mTypes.LIST_VISIBLE },
        media_id: { $lt: media.media_id }
      })
      .select('media_id')
      .sort('-media_id')
      .lean(true)
      .exec(function (err, result) {
        if (err) {
          callback(err);
          return;
        }

        if (result) {
          env.res.next = result.media_id;
        }
        callback();
      });
  });


  // Fill head meta
  //
  N.wire.after(apiPath, function fill_head(env) {
    var user = env.data.user;
    var username = env.runtime.is_member ? user.name : user.nick;

    env.res.head = env.res.head || {};
    env.res.head.title = env.t('title', { album: env.data.album.title, username: username });
  });


  // Fill breadcrumbs
  //
  N.wire.after(apiPath, function fill_breadcrumbs(env) {
    N.wire.emit('internal:users.breadcrumbs.fill_albums', env);

    env.data.breadcrumbs.push({
      text   : env.data.album.title,
      route  : 'users.album',
      params : { 'user_hid': env.data.user.hid, 'album_id': env.data.album._id }
    });

    env.res.breadcrumbs = env.data.breadcrumbs;
  });
};
