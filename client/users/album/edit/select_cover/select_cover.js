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


var _ = require('lodash');


var $dialog;
var onCoverSelected;
var dialogData;

// Init dialog on event
//
N.wire.on('users.album.edit.select_cover', function show_select_cover() {
  $dialog = $(N.runtime.render('users.album.edit.select_cover'));
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
N.wire.after('users.album.edit.select_cover', function load_photos(data, callback) {
  onCoverSelected = callback;
  dialogData = data;

  N.io.rpc('users.album.list', { user_hid: data.user_hid, album_id: data.album_id }).done(function (mediaList) {
    var medias = _.filter(mediaList.medias, function (media) {
      return media.type === 'image';
    });
    var $list = $(N.runtime.render('users.album.edit.select_cover.media_list', { medias: medias }));
    $('#select_cover__photos').html($list);
  });
});


// Click to cover
//
N.wire.on('users.album.edit.select_cover:select', function select_cover(event) {
  var $item = $(event.currentTarget);
  dialogData.cover_id = $item.data('media_id');
  onCoverSelected();
  $dialog.modal('hide');

  event.stopPropagation();
});


// Close dialog on sudden page exit (if user click back button in browser)
//
N.wire.on('navigate.exit', function teardown_page() {
  if ($dialog) {
    $dialog.modal('hide');
  }
});
