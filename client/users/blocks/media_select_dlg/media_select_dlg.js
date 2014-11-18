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


function loadAlbumContent(albumID, page, append) {
  N.io.rpc('users.album.list', { user_hid: N.runtime.user_hid, album_id: albumID, page: page })
    .done(function (mediaList) {

      var medias = _.filter(mediaList.medias, function (media) {
        return options.types.indexOf(media.type) !== -1;
      });

      var data = {
        medias: medias,
        user_hid: mediaList.user_hid,
        page: page,
        album_id: albumID,
        show_more: page && mediaList.medias.length === mediaList.photos_per_page
      };

      var $media = $(N.runtime.render('users.blocks.media_select_dlg.media_list', data));

      if (append) {
        var $morePhotos = $dialog.find('.media-select-dlg__more-photos');

        if (data.show_more) {
          $morePhotos.data('album-id', albumID).data('page', page);
        } else {
          $morePhotos.hide();
        }

        $dialog.find('.media-select-dlg__content li:last').after($media.find('li'));
      } else {
        $dialog.find('.media-select-dlg__content').empty().append($media);
      }

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
  N.wire.on('users.blocks.media_select_dlg:more_photos', function more_photos (event) {
    var $target = $(event.currentTarget);
    var page = $target.data('page');
    var albumID = $target.data('album-id');

    loadAlbumContent(albumID, page + 1, true);
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
    var id = $target.val();

    if (id !== '') {
      loadAlbumContent(id);
    } else {
      loadAlbumContent(undefined, 1);
    }
  });
});


// Init dialog on event
//
N.wire.on('users.blocks.media_select_dlg', function show_media_select_dlg(data, callback) {

  options = data;
  options.selected = options.selected || [];
  doneCallback = callback;

  N.io.rpc('users.albums_root.list', { user_hid: N.runtime.user_hid }).done(function (albumsList) {
    albumsList.albums.unshift({ title: t('album_list.all') });

    $dialog = $(N.runtime.render('users.blocks.media_select_dlg', albumsList));

    $('body').append($dialog);

    $dialog
      .on('hidden.bs.modal', function () {
        $dialog.remove();
        $dialog = null;
        doneCallback = null;
        options = null;
      })
      .modal('show');

    loadAlbumContent(albumsList.albums[0]._id, 1);
  });

});
