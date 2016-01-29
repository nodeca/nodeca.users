'use strict';

var pageParams;

N.wire.on('navigate.done:' + module.apiPath, function setup_page(data) {
  pageParams = data.params;

  $('#album-edit__title').focus();
});


N.wire.on('users.album.edit:save', function save_album(form) {
  var title = form.fields.title;
  // Don't allow empty name for albums
  if (!title || !$.trim(title)) {
    N.wire.emit('notify', t('err_empty_name'));
    return;
  }

  // If cover_id isn't set - don't send empty field to server
  if (form.fields.cover_id === '') {
    delete form.fields.cover_id;
  }

  N.io.rpc('users.album.update', form.fields).then(function () {
    N.wire.emit('navigate.to', { apiPath: 'users.album', params: pageParams });
  });
});


N.wire.before('users.album.edit:delete', function confirm_delete_album(data, callback) {
  N.wire.emit('common.blocks.confirm', t('delete_confirmation'), callback);
});


N.wire.on('users.album.edit:delete', function delete_album(data) {
  N.io.rpc('users.album.destroy', { album_id: data.$this.data('albumId') }).then(function () {
    N.wire.emit('navigate.to', { apiPath: 'users.albums_root', params: { user_hid: pageParams.user_hid } });
  });
});


N.wire.on('users.album.edit:select_cover', function select_cover() {
  var data = { user_hid: pageParams.user_hid, album_id: pageParams.album_id, cover_id: null };
  N.wire.emit('users.album.edit.select_cover', data, function () {
    $('#album-edit__cover input[name="cover_id"]').val(data.cover_id);
    $('#album-edit__cover').addClass('has-cover');

    var imageUrl = N.router.linkTo('core.gridfs', { bucket: data.cover_id + '_sm' });
    $('#album-edit__cover-img').attr('src', imageUrl);
  });
});
