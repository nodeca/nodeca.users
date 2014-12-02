// Files select dialog
//
// - options
//   - (out) selected [ { id: file id, name: file name } ] - selected files
//
// - callback
//


'use strict';

var _ = require('lodash');


var $dialog;
var options;
var doneCallback;

var albumID;
var nextMediaID;


function loadMedias() {
  N.io.rpc('users.media_select.index', {
    user_hid: N.runtime.user_hid,
    album_id: albumID,
    from_media_id: nextMediaID
  }).done(function (mediaList) {

    var $content = $dialog.find('.media-select-dlg__content');

    var $medias = $(N.runtime.render('users.blocks.media_select_dlg.media_list', {
      medias: mediaList.medias,
      user_hid: N.runtime.user_hid
    }));

    if (mediaList.next_media_id) {
      $dialog.removeClass('no-more-medias');
    } else {
      $dialog.addClass('no-more-medias');
    }

    if (!nextMediaID) {
      $content.empty();

      if (mediaList.medias.length === 0) {
        $dialog.addClass('no-medias');
      } else {
        $dialog.removeClass('no-medias');
      }
    }

    $content.append($medias);

    nextMediaID = mediaList.next_media_id;

    options.selected.forEach(function (mediaInfo) {
      $dialog.find('#media-select-dlg__media-' + mediaInfo.media_id).addClass('selected');
    });
  });
}


// Init event handlers
//
N.wire.once('users.blocks.media_select_dlg', function init_event_handlers() {

  // Append more photos button handler
  //
  N.wire.on('users.blocks.media_select_dlg:more_photos', function more_photos () {
    loadMedias();
  });


  N.wire.on('users.blocks.media_select_dlg:media_select', function media_select (event) {
    var $target = $(event.currentTarget);
    var id = $target.data('media-id');
    var $listItem = $('#media-select-dlg__media-' + id);

    if (_.findIndex(options.selected, function (mediaInfo) { return mediaInfo.media_id === id; }) === -1) {
      $listItem.addClass('selected');

      options.selected.push({
        media_id: id,
        file_name: $target.data('file-name'),
        type: $target.data('type')
      });

    } else {
      $listItem.removeClass('selected');
      options.selected = _.remove(options.selected, function (mediaInfo) { return mediaInfo.media_id !== id; });
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

    albumID = $target.val() || undefined;
    nextMediaID = undefined;
    loadMedias();
  });
});


// Init dialog on event
//
N.wire.on('users.blocks.media_select_dlg', function show_media_select_dlg(data, callback) {

  options = data;
  options.selected = options.selected || [];
  doneCallback = callback;

  N.io.rpc('users.albums_root.list', { user_hid: N.runtime.user_hid }).done(function (albumsList) {
    albumsList.albums.unshift({ title: t('all') });

    $dialog = $(N.runtime.render('users.blocks.media_select_dlg', albumsList));

    $('body').append($dialog);

    $dialog
      .keypress(function (e) {
        // Apply selected on `enter` key
        if (e.which === 13) {
          N.wire.emit('users.blocks.media_select_dlg:apply');
        }
      })
      .on('hidden.bs.modal', function () {
        $dialog.remove();
        $dialog = null;
        doneCallback = null;
        options = null;
      })
      .modal('show');

    albumID = albumsList.albums[0]._id;
    nextMediaID = undefined;
    loadMedias();
  });
});
