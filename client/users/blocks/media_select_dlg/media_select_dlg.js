// Files select dialog
//
// - options
//   - (out) selected [ { id: file id, name: file name } ] - selected files
//   - types [ String ] - array of allowed types (image, medialink or binary)
//
// - callback
//


'use strict';

var _ = require('lodash');


var $dialog;
var options;
var doneCallback;


function loadAlbumContent(albumID) {
  N.io.rpc('users.album.list', { user_hid: N.runtime.user_hid, album_id: albumID }).done(function (mediaList) {

    var medias = _.filter(mediaList.medias, function (media) {
      return options.types.indexOf(media.type) !== -1;
    });

    var $media = $(N.runtime.render('users.blocks.media_select_dlg.media_list', { medias: medias }));

    $dialog.find('.media-select-dlg__files').empty().append($media);

    options.selected.forEach(function (file) {
      $dialog.find('#media-select-dlg__media-' + file.id).addClass('selected');
    });
  });
}


// Init event handlers
//
N.wire.once('users.blocks.media_select_dlg', function init_event_handlers() {


  N.wire.on('users.blocks.media_select_dlg:media_select', function media_select (event) {
    var $target = $(event.currentTarget);
    var id = $target.data('file-id');

    if (_.findIndex(options.selected, function (file) { return file.id === id; }) === -1) {
      $target.addClass('selected');
      options.selected.push({ id: id, name: $target.data('file-name') });
    } else {
      $target.removeClass('selected');
      options.selected = _.remove(options.selected, function (file) { return file.id !== id; });
    }

    event.stopPropagation();
  });


  N.wire.on('users.blocks.media_select_dlg:apply', function apply () {
    // stub
    doneCallback();

    $dialog.modal('hide');
  });


  N.wire.on('users.blocks.media_select_dlg:album_select', function album_select (event) {
    var $target = $(event.target);

    loadAlbumContent($target.data('album-id'));
  });
});


// Init dialog on event
//
N.wire.on('users.blocks.media_select_dlg', function show_media_select_dlg(data, callback) {

  options = data;
  options.selected = options.selected || [];
  doneCallback = callback;
  $dialog = $(N.runtime.render('users.blocks.media_select_dlg'));

  $('body').append($dialog);

  $dialog
    .on('hidden.bs.modal', function () {
      $dialog.remove();
      $dialog = null;
      doneCallback = null;
      options = null;
    })
    .modal('show');

  N.io.rpc('users.albums_root.list', { user_hid: N.runtime.user_hid }).done(function (albumsList) {
    var $albums = $(N.runtime.render('users.blocks.media_select_dlg.album_list', albumsList));

    $dialog.find('.media-select-dlg__albums').append($albums);

    loadAlbumContent(albumsList.albums[0]._id);
  });

});
