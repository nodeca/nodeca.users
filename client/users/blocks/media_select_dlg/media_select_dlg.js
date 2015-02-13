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


function loadDialogContent(selectedAlbumID) {
  var user_hid = N.runtime.user_hid;

  N.io.rpc('users.media_select.index', { album_id: selectedAlbumID, user_hid: user_hid }).done(function (res) {
    // Add virtual item (all photos) to albums list
    res.albums.unshift({ title: t('all') });

    var $dlgBody = $(N.runtime.render('users.blocks.media_select_dlg.dlg_body', {
      albums: res.albums,
      medias: res.medias,
      user_hid: user_hid,
      selected_album_id: selectedAlbumID
    }));

    if (res.medias.length === 0) {
      $dialog.addClass('no-medias');
    } else {
      $dialog.removeClass('no-medias');
    }

    if (res.next_media_id) {
      $dialog.removeClass('no-more-medias');
    } else {
      $dialog.addClass('no-more-medias');
    }

    nextMediaID = res.next_media_id;
    albumID = selectedAlbumID;

    $dialog.find('.media_select_dlg__body').html($dlgBody);

    options.selected.forEach(function (mediaInfo) {
      $dialog.find('#media-select-dlg__media-' + mediaInfo.media_id).addClass('selected');
    });
  });
}


function destroyDialog(callback) {
  $dialog.on('hidden.bs.modal', function () {
    $dialog.remove();
    $dialog = null;
    doneCallback = null;
    options = null;

    if (callback) {
      callback();
    }
  }).modal('hide');
}


// Init event handlers
//
N.wire.once('users.blocks.media_select_dlg', function init_event_handlers() {

  // Upload files button handler
  //
  N.wire.on('users.blocks.media_select_dlg:select_files', function select_files() {
    $dialog.find('.media-select-dlg__files').click();
  });


  // Upload selected files
  //
  N.wire.on('users.blocks.media_select_dlg:upload', function upload_files(data) {
    var files = data.$this.get(0).files;

    if (files.length > 0) {
      var params = {
        files: files,
        url: N.router.linkTo('users.media.upload', { album_id: albumID }),
        config: 'users.uploader_config',
        uploaded: null
      };

      // Hide current dialog and start uploader dialog
      $dialog.on('hidden.bs.modal', function () {

        N.wire.emit('users.uploader:add', params, function() {
          if (params.uploaded.length === 0) {

            // No files uploaded. Show media select dialog again
            $dialog
              .off('hidden.bs.modal')
              .modal('show');

            return;
          }

          var $uploadedMedias = $(N.runtime.render(
            'users.blocks.media_select_dlg.media_list',
            {
              medias: params.uploaded,
              user_hid: N.runtime.user_hid
            }
          ));

          $dialog
            .off('hidden.bs.modal') // show media select dialog again
            .modal('show') // remove `no-medias` modifier because album can't be empty
            .removeClass('no-medias')
            .find('.media-select-dlg__content') // show uploaded medias
            .prepend($uploadedMedias);

          params.uploaded.forEach(function (mediaInfo) {
            options.selected.push(mediaInfo);
            $dialog.find('#media-select-dlg__media-' + mediaInfo.media_id).addClass('selected');
          });
        });
      }).modal('hide');
    }
  });


  // Create album button handler
  //
  N.wire.on('users.blocks.media_select_dlg:create_album', function create_album() {
    $dialog.on('hidden.bs.modal', function () {
      var params = { album: null };

      N.wire.emit('users.album.create', params, function () {

        if (params.album) {
          loadDialogContent(params.album._id);
        }

        $dialog
          .off('hidden.bs.modal')
          .modal('show');
      });
    }).modal('hide');
  });


  // Append more photos button handler
  //
  N.wire.on('users.blocks.media_select_dlg:more_photos', function more_photos () {
    N.io.rpc('users.media_select.index', {
      user_hid: N.runtime.user_hid,
      album_id: albumID,
      from_media_id: nextMediaID
    }).done(function (req) {

      var $medias = $(N.runtime.render('users.blocks.media_select_dlg.media_list', {
        medias: req.medias,
        user_hid: N.runtime.user_hid
      }));

      if (req.next_media_id) {
        $dialog.removeClass('no-more-medias');
      } else {
        $dialog.addClass('no-more-medias');
      }

      $dialog.find('.media-select-dlg__content').append($medias);

      nextMediaID = req.next_media_id;

      options.selected.forEach(function (mediaInfo) {
        $dialog.find('#media-select-dlg__media-' + mediaInfo.media_id).addClass('selected');
      });
    });
  });


  N.wire.on('users.blocks.media_select_dlg:media_select', function media_select (data) {
    var id = data.$this.data('media-id');
    var $listItem = $('#media-select-dlg__media-' + id);

    if (_.findIndex(options.selected, function (mediaInfo) { return mediaInfo.media_id === id; }) === -1) {
      $listItem.addClass('selected');

      options.selected.push({
        media_id: id,
        file_name: data.$this.data('file-name'),
        type: data.$this.data('type')
      });

    } else {
      $listItem.removeClass('selected');
      options.selected = _.remove(options.selected, function (mediaInfo) { return mediaInfo.media_id !== id; });
    }
  });


  // Handle albums select change
  //
  N.wire.on('users.blocks.media_select_dlg:album_select', function album_select (data) {
    loadDialogContent(data.$this.val() || undefined);
  });


  // OK button handler
  //
  N.wire.on('users.blocks.media_select_dlg:done', function apply () {
    destroyDialog(doneCallback);
  });


  // Close dialog handler
  //
  N.wire.on('users.blocks.media_select_dlg:close', function close() {
    destroyDialog();
  });


  // Close dialog on sudden page exit (if user click back button in browser)
  //
  N.wire.on('navigate.exit', function teardown_page(__, callback) {
    if (!$dialog) {
      callback();
      return;
    }

    destroyDialog(callback);
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
    .keypress(function (e) {
      // Apply selected on `enter` key
      if (e.which === 13) {
        N.wire.emit('users.blocks.media_select_dlg:apply');
      }
    })
    // Close dialog on click outside `.modal-content`
    .click(function (event) {
      if (event.target !== event.currentTarget) {
        return;
      }

      destroyDialog();
    })
    .modal('show');

  loadDialogContent();
});
