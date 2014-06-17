// Render media page


'use strict';


// comment statuses
var commentStatuses = require('../_lib/statuses.js');


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: {
      type: 'integer',
      minimum: 1,
      required: true
    },
    media_id: {
      format: 'mongo'
    }
  });


  // Fetch owner by hid
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env, callback) {
    N.wire.emit('internal:users.fetch_user_by_hid', env, callback);
  });


  // Fetch media
  //
  N.wire.before(apiPath, function fetch_media(env, callback) {
    N.models.users.Media
      .findOne({ '_id': env.params.media_id })
      .where({ 'user_id': env.data.user._id }) // Make sure that user is real owner
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

        env.data.media = result;
        callback();
      });
  });


  // Prepare list of visible comments statuses depending on user permissions
  //
  N.wire.before(apiPath, function define_visible_statuses(env, callback) {

    env.extras.settings.fetch(['can_see_hellbanned'], function (err, settings) {

      if (err) {
        callback(err);
        return;
      }

      env.data.statuses = [commentStatuses.comment.VISIBLE];
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

    N.models.users.Comment
      .find({ 'media_id': env.params.media_id })
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

    env.extras.puncher.start('collect users ids');

    env.res.comments = env.data.comments;

    env.data.users = env.data.users || [];

    // collect users
    env.data.comments.forEach(function (comment) {
      if (comment.user_id) {
        env.data.users.push(comment.user_id);
      }
    });

    env.extras.puncher.stop();

    callback();
  });


  // Fill head meta
  //
  N.wire.after(apiPath, function fill_head(env) {
    env.res.head = env.res.head || {};
    env.res.head.title = env.t('title');
  });


  // Fill breadcrumbs
  //
  N.wire.after(apiPath, function fill_breadcrumbs(env) {
    var user = env.data.user;
    var album = env.data.album;

    var breadcrumbs = [];

    breadcrumbs.push({
      'text': env.runtime.is_member ? user.name : user.nick,
      'route': 'users.member',
      'params': { 'user_hid': user.hid }
    });

    breadcrumbs.push({
      'text': env.t('albums_breadcrumbs_title'),
      'route': 'users.albums_root',
      'params': { 'user_hid': user.hid }
    });

    breadcrumbs.push({
      'text': album.title,
      'route': 'users.album',
      'params': { 'user_hid': user.hid, 'album_id': album._id }
    });

    env.res.blocks.breadcrumbs = breadcrumbs;
  });
};
