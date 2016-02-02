// Popup dialog to select cover
//
// Example:
//
//   let data = { user_hid: 1, album_id: '53b56152d798153c8e94816e', cover_id: null };
//   N.wire.emit('users.album.edit.select_cover')
//     .then(() => { /* use data.cover_id here */ });
//
'use strict';


let $dialog;
let params;
let result;


// Init dialog on event
//
N.wire.on(module.apiPath, function show_select_cover(data) {
  params = data;
  $dialog = $(N.runtime.render('users.album.edit.select_cover'));
  $('body').append($dialog);

  return N.io.rpc('users.album.select_cover.index', { album_id: data.album_id }).then(res => {
    let $list = $(N.runtime.render('users.album.edit.select_cover.media_list', {
      medias: res.medias,
      user_hid: params.user_hid
    }));

    $dialog.find('.modal-body').html($list);

    return new Promise((resolve, reject) => {
      $dialog
        .on('hidden.bs.modal', function () {
          // When dialog closes - remove it from body
          $dialog.remove();
          $dialog = null;
          params = null;

          if (result) resolve(result);
          else reject('CANCELED');

          result = null;
        })
        .modal('show');
    });
  });
});


// Click to cover
//
N.wire.on(module.apiPath + ':select', function select_cover(data) {
  params.cover_id = result = data.$this.data('media_id');
  $dialog.modal('hide');
});


// Close dialog on sudden page exit (if user click back button in browser)
//
N.wire.on('navigate.exit', function teardown_page() {
  if ($dialog) {
    $dialog.modal('hide');
  }
});
