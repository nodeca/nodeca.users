// Fetch media list


'use strict';

const _ = require('lodash');


// Max media files to fetch before and after
const LIMIT = 100;


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: { type: 'integer', minimum: 1, required: true },
    album_id: { format: 'mongo' },
    media_id: { format: 'mongo' },
    before:   { type: 'integer', minimum: 0, maximum: LIMIT, required: true },
    after:    { type: 'integer', minimum: 0, maximum: LIMIT, required: true }
  });


  // Fetch user
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env) {
    return N.wire.emit('internal:users.fetch_user_by_hid', env);
  });


  // Forbid access to pages owned by bots
  //
  N.wire.before(apiPath, async function bot_member_pages_forbid_access(env) {
    let is_bot = await N.settings.get('is_bot', {
      user_id: env.data.user._id,
      usergroup_ids: env.data.user.usergroups
    }, {});

    if (is_bot) throw N.io.NOT_FOUND;
  });


  // Find and processes user media
  //
  N.wire.on(apiPath, function* get_user_medias(env) {
    var criteria = {
      type: { $in: N.models.users.MediaInfo.types.LIST_VISIBLE }
    };

    // If album_id not set, will fetch all user medias
    if (env.params.album_id) {
      criteria.album = env.params.album_id;
    } else {
      criteria.user = env.data.user._id;
    }

    let result;

    env.res.media = [];

    if (env.params.before && env.params.media_id) {
      let query = _.assign({ media_id: { $gt: env.params.media_id } }, criteria);

      result = yield N.models.users.MediaInfo.find(query)
                                             .lean(true)
                                             .sort('media_id')
                                             .limit(env.params.before + 1);

      if (result.length > env.params.before) {
        let prev_media = result.pop();

        env.res.prev_media = prev_media.media_id;
        env.res.head = env.res.head || {};
        env.res.head.prev = N.router.linkTo('users.album', {
          user_hid: env.data.user.hid,
          album_id: env.params.album_id,
          media_id: env.res.prev_media
        });
      }

      env.res.media = env.res.media.concat(result.reverse());
    }

    if (env.params.after) {
      let query;

      if (env.params.media_id) {
        query = _.assign({
          media_id: env.params.before ? { $lte: env.params.media_id } : { $lt: env.params.media_id }
        }, criteria);
      } else {
        query = criteria;
      }

      result = yield N.models.users.MediaInfo.find(query)
                                             .lean(true)
                                             .sort('-media_id')
                                             .limit(env.params.after + 1);

      if (result.length > env.params.after) {
        let next_media = result.pop();

        env.res.next_media = next_media.media_id;
        env.res.head = env.res.head || {};
        env.res.head.next = N.router.linkTo('users.album', {
          user_hid: env.data.user.hid,
          album_id: env.params.album_id,
          media_id: env.res.next_media
        });
      }

      env.res.media = env.res.media.concat(result);
    }

    env.res.user_hid = env.data.user.hid;
  });
};
