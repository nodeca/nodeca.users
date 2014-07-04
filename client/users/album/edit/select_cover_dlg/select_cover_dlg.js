// Popup dialog to select cover
//
// Example:
//
// var data = { user_hid: 1, album_id: '53b56152d798153c8e94816e', cover_id: null };
// N.wire.emit('users.album.edit.select_cover', , function () {
//   // data.cover_id is new cover file id
// });
//

'use strict';


var $dialog;
var onCoverSelected;
var dialogData;

// Init dialog on event
//
N.wire.on('users.album.edit.select_cover_dlg', function show_select_cover_dlg() {
  $dialog = $(N.runtime.render('users.album.edit.select_cover_dlg'));
  $('body').append($dialog);

  // When dialog closes - remove it from body
  $dialog.on('hidden.bs.modal', function () {
    $dialog.remove();
    $dialog = null;
    onCoverSelected = null;
    dialogData = null;
  });

  $dialog.modal('show');
});


// Load album photos
//
N.wire.after('users.album.edit.select_cover_dlg', function load_photos(data, callback) {
  onCoverSelected = callback;
  dialogData = data;

  N.io.rpc('users.album.media_list', { user_hid: data.user_hid, album_id: data.album_id }, function (err, mediaList) {
    if (err) {
      return false;
    }

    var $list = $(N.runtime.render('users.album.edit.select_cover_dlg.media_list', { medias: mediaList.medias }));
    $('#users-album-edit-select_cover_dlg__media-list').html($list);
  });
});


// Click to cover
//
N.wire.on('users.album.edit.select_cover_dlg:select', function select_cover(event) {
  var $item = $(event.target);
  dialogData.cover_id = $item.data('file_id');
  onCoverSelected();
  $dialog.modal('hide');
});


// Close dialog on sudden page exit (if user click back button in browser)
//
N.wire.on('navigate.exit', function teardown_page() {
  if ($dialog) {
    $dialog.modal('hide');
  }
});
