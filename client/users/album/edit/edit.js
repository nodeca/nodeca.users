'use strict';


let pageParams;


N.wire.on('navigate.done:' + module.apiPath, function setup_page(data) {
  pageParams = data.params;

  $('#album-edit__title').focus();
});


N.wire.on(module.apiPath + ':save', function save_album(form) {
  let title = form.fields.title;

  // Don't allow empty name for albums
  if (!title || !$.trim(title)) {
    N.wire.emit('notify', t('err_empty_name'));
    return;
  }

  // If cover_id isn't set - don't send empty field to server
  if (form.fields.cover_id === '') {
    delete form.fields.cover_id;
  }

  return N.io.rpc('users.album.update', form.fields)
    .then(() => N.wire.emit('navigate.to', { apiPath: 'users.album', params: pageParams }));
});


N.wire.on(module.apiPath + ':select_cover', function select_cover() {
  let  data = { user_hid: pageParams.user_hid, album_id: pageParams.album_id, cover_id: null };

  return N.wire.emit('users.album.edit.select_cover', data)
    .then(() => {
      let imageUrl = N.router.linkTo('core.gridfs', { bucket: data.cover_id + '_sm' });

      $('#album-edit__cover input[name="cover_id"]').val(data.cover_id);
      $('#album-edit__cover').addClass('has-cover');
      $('#album-edit__cover-img').attr('src', imageUrl);
    });
});
