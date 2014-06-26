'use strict';

var user_hid;


N.wire.on('navigate.done:' + module.apiPath, function setup_page(data) {
  user_hid = data.params.user_hid;
});


N.wire.on('users.album.edit:save', function save_album(form) {
  var title = form.fields.title;
  // Don't allow empty name for albums
  if (!title || !$.trim(title)) {
    N.wire.emit('notify', t('err_empty_name'));
    return;
  }

  N.io.rpc('users.album.update', form.fields, function (err) {
    if (err) {
      return false;
    }
    window.location = N.runtime.router.linkTo('users.albums_root', { 'user_hid': user_hid });
  });
});


N.wire.on('users.album.edit:delete', function delete_album(event) {
  if (window.confirm(t('delete_confirmation'))) {
    N.io.rpc('users.album.destroy', { 'album_id': $(event.target).data('albumId') }, function (err) {
      if (err) {
        return false;
      }
      window.location = N.runtime.router.linkTo('users.albums_root', { 'user_hid': user_hid });
    });
  }
});
