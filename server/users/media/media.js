// Render media page


'use strict';


// comment statuses
const commentStatuses = require('../_lib/statuses.js');
const fields = require('./_fields.js');


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: { type: 'integer', minimum: 1, required: true },
    media_id: { format: 'mongo', required: true }
  });


  // shortcuts
  let Comment = N.models.users.Comment;


  // Fetch owner by hid
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env) {
    return N.wire.emit('internal:users.fetch_user_by_hid', env);
  });


  // Fetch media
  //
  N.wire.before(apiPath, function* fetch_media(env) {
    let deletedTypes = N.models.users.MediaInfo.types.LIST_DELETED;
    let result = yield  N.models.users.MediaInfo
                            .findOne({ media_id: env.params.media_id })
                            .where({ user_id: env.data.user._id }) // Make sure that user is real owner
                            .lean(true);

    if (!result) {
      throw N.io.NOT_FOUND;
    }

    if (deletedTypes.indexOf(result.type) !== -1 && env.user_info.user_id !== String(result.user_id)) {
      throw N.io.NOT_FOUND;
    }

    env.data.media = result;
  });


  // Prepare list of visible comments statuses depending on user permissions
  //
  N.wire.before(apiPath, function* define_visible_statuses(env) {
    let settings = yield env.extras.settings.fetch([ 'can_see_hellbanned' ]);

    env.data.statuses = [ commentStatuses.comment.VISIBLE ];

    let st = env.data.statuses;

    // if user can see HB post than can see HB content
    if (settings.can_see_hellbanned || env.user_info.hb) {
      st.push(commentStatuses.comment.HB);
    }
  });


  // Fetch album
  //
  N.wire.before(apiPath, function* fetch_media(env) {
    let result = yield N.models.users.Album
                          .findOne({ _id: env.data.media.album_id })
                          .where({ user_id: env.data.user._id }) // Make sure that user is real owner
                          .lean(true);

    // That should never happen
    if (!result) {
      throw N.io.NOT_FOUND;
    }

    result.title = result.title || env.t('default_name');
    env.data.album = result;
  });


  // Prepare comments and medias
  //
  N.wire.on(apiPath, function* prepare_comment(env) {
    env.res.media = env.data.media;
    env.res.user_hid = env.data.user.hid;

    let result = yield N.models.users.Comment
                          .find({ media_id: env.data.media.media_id }, fields.post_in.join(' '))
                          .where('st').in(env.data.statuses)
                          .lean(true);

    if (!result) {
      throw N.io.NOT_FOUND;
    }

    env.data.comments = result;
  });


  // Add comments into response & collect user ids
  //
  N.wire.after(apiPath, function build_comments_list_and_users(env) {
    env.res.comments = env.data.comments;
    env.data.users = env.data.users || [];

    // collect users
    env.data.comments.forEach(comment => {
      if (comment.user) {
        env.data.users.push(comment.user);
      }
    });
  });


  // Sanitize response info. We should not show hellbanned status to users
  // that cannot view hellbanned content.
  //
  N.wire.after(apiPath, function* sanitize_statuses(env) {
    let settings = yield env.extras.settings.fetch([ 'can_see_hellbanned' ]);

    // Sanitize commets statuses
    let comments = env.res.comments;

    comments.forEach(comment => {
      Comment.sanitize(comment, {
        keep_statuses: settings.can_see_hellbanned
      });
    });
  });


  // Fill previous media _id
  //
  N.wire.after(apiPath, function* fill_previous(env) {
    let mTypes = N.models.users.MediaInfo.types;
    let media = env.data.media;
    let result = yield N.models.users.MediaInfo
                          .findOne({
                            album_id: media.album_id,
                            type: { $in: mTypes.LIST_VISIBLE },
                            media_id: { $gt: media.media_id }
                          })
                          .select('media_id')
                          .sort('media_id')
                          .lean(true);

    if (result) {
      env.res.previous = result.media_id;

      env.res.head = env.res.head || {};

      env.res.head.prev = N.router.linkTo('users.media', {
        user_hid: env.data.user.hid,
        media_id: result.media_id
      });
    }
  });


  // Fill next media _id
  //
  N.wire.after(apiPath, function* fill_next(env) {
    let mTypes = N.models.users.MediaInfo.types;
    let media = env.data.media;
    let result = yield N.models.users.MediaInfo
                          .findOne({
                            album_id: media.album_id,
                            type: { $in: mTypes.LIST_VISIBLE },
                            media_id: { $lt: media.media_id }
                          })
                          .select('media_id')
                          .sort('-media_id')
                          .lean(true);

    if (result) {
      env.res.next = result.media_id;

      env.res.head = env.res.head || {};

      env.res.head.next = N.router.linkTo('users.media', {
        user_hid: env.data.user.hid,
        media_id: result.media_id
      });
    }
  });


  // Fill head meta
  //
  N.wire.after(apiPath, function fill_head(env) {
    let user = env.data.user;
    let username = env.user_info.is_member ? user.name : user.nick;

    env.res.head = env.res.head || {};
    env.res.head.title = env.t('title', { album: env.data.album.title, username });
  });


  // Fill breadcrumbs
  //
  N.wire.after(apiPath, function* fill_breadcrumbs(env) {
    yield N.wire.emit('internal:users.breadcrumbs.fill_albums', env);

    env.data.breadcrumbs.push({
      text   : env.data.album.title,
      route  : 'users.album',
      params : { user_hid: env.data.user.hid, album_id: env.data.album._id }
    });

    env.res.breadcrumbs = env.data.breadcrumbs;
  });
};
