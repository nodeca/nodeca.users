// Shows album/all medias page
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: { type: 'integer', minimum: 1, required: true },
    album_id: { format: 'mongo' }
  });


  // Fetch owner
  //
  N.wire.before(apiPath, function* fetch_user_by_hid(env) {
    yield N.wire.emit('internal:users.fetch_user_by_hid', env);
  });


  // Fetch album info (by album_id)
  //
  N.wire.before(apiPath, function* fetch_album(env) {
    if (!env.params.album_id) return;

    let album = yield N.models.users.Album
                          .findOne({ _id: env.params.album_id })
                          .lean(true);

    if (!album) throw N.io.NOT_FOUND;

    album.title = album.title || env.t('default_name');
    env.data.album = album;
  });


  // Fill available embed providers
  //
  N.wire.before(apiPath, function* fill_providers(env) {
    let data = {};

    env.res.medialink_providers = [];

    yield N.wire.emit('internal:users.album.create_embedza', data);

    data.embedza.forEach(domain => {
      if (!domain.enabled) return;

      env.res.medialink_providers.push({
        home: 'http://' + domain.id,
        name: domain.id
      });
    });
  });


  // Get medias list (subcall)
  //
  N.wire.on(apiPath, function* get_user_albums(env) {
    env.res.album = env.data.album;

    yield N.wire.emit('server:users.album.list', env);
  });


  // Fill head meta
  //
  N.wire.after(apiPath, function fill_head(env) {
    let username = env.user_info.is_member ? env.data.user.name : env.data.user.nick;

    env.res.head = env.res.head || {};

    if (env.data.album) {
      env.res.head.title = env.t('title_album_with_user', { album: env.data.album.title, username });
    } else {
      env.res.head.title = env.t('title_with_user', { username });
    }
  });


  // Fill breadcrumbs
  //
  N.wire.after(apiPath, function* fill_breadcrumbs(env) {
    yield N.wire.emit('internal:users.breadcrumbs.fill_albums', env);

    env.res.breadcrumbs = env.data.breadcrumbs;
  });
};
