'use strict';

var pageParams;

N.wire.on('navigate.done:' + module.apiPath, function setup_page(data) {
  pageParams = data.params;
});


N.wire.on('users.album.edit:save', function save_album(form) {
  var title = form.fields.title;
  // Don't allow empty name for albums
  if (!title || !$.trim(title)) {
    N.wire.emit('notify', t('err_empty_name'));
    return;
  }

  N.io.rpc('users.album.update', form.fields).done(function () {
    window.location = N.router.linkTo('users.album', pageParams);
  });
});


N.wire.before('users.album.edit:delete', function confirm_delete_album(event, callback) {
  N.wire.emit('common.blocks.confirm', t('delete_confirmation'), callback);
});


N.wire.on('users.album.edit:delete', function delete_album(event) {
  N.io.rpc('users.album.destroy', { 'album_id': $(event.target).data('albumId') }).done(function () {
    window.location = N.router.linkTo('users.albums_root', { 'user_hid': pageParams.user_hid });
  });
});


N.wire.on('users.album.edit:reset_cover', function reset_cover() {
  $('#album-edit__cover').removeClass('has-cover');
  $('#album-edit__cover input[name="cover_id"]').val('');
});


N.wire.on('users.album.edit:select_cover', function select_cover() {
  var data = { user_hid: pageParams.user_hid, album_id: pageParams.album_id, cover_id: null };
  N.wire.emit('users.album.edit.select_cover', data, function () {
    $('#album-edit__cover input[name="cover_id"]').val(data.cover_id);
    $('#album-edit__cover').addClass('has-cover');

    var imageUrl = N.router.linkTo('core.gridfs', { 'bucket': data.cover_id + '_sm' });
    $('#album-edit__cover-img').attr('src', imageUrl);
  });
});
