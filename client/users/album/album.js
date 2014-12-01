'use strict';

var pageParams;
var $dropZone;


////////////////////////////////////////////////////////////////////////////////
// Uploader
//


N.wire.on('navigate.done:' + module.apiPath, function page_setup(data) {
  $dropZone = $('.user-album-upload');
  pageParams = data.params;

  $('.user-album-upload__files').on('change', function () {
    var files = $(this).get(0).files;
    var params = {
      files: files,
      url: N.router.linkTo('users.media.upload', { album_id: pageParams.album_id }),
      config: 'users.uploader_config',
      uploaded: null
    };

    if (files.length > 0) {
      N.wire.emit('users.uploader:add', params, function() {
        $('#users-medias-list').prepend(
          $(N.runtime.render('users.album.list', { medias: params.uploaded, user_hid: pageParams.user_hid }))
        );
      });
    }
  });
});


N.wire.once('navigate.done:' + module.apiPath, function page_once() {

  N.wire.on('users.album:select_files', function select_files() {
    $('.user-album-upload__files').click();
  });


  // Handles the event when user drag file to drag drop zone
  //
  N.wire.on('users.album:dd_area', function user_album_dd(event) {
    var x0, y0, x1, y1, ex, ey;

    switch (event.type) {
      case 'dragenter':
        $dropZone.addClass('active');
        break;
      case 'dragleave':
        // 'dragleave' occurs when user move cursor over child HTML element
        // track this situation and don't remove 'active' class
        // http://stackoverflow.com/questions/10867506/
        x0 = $dropZone.offset().left;
        y0 = $dropZone.offset().top;
        x1 = x0 + $dropZone.outerWidth();
        y1 = y0 + $dropZone.outerHeight();
        ex = event.originalEvent.pageX;
        ey = event.originalEvent.pageY;

        if (ex > x1 || ex < x0 || ey > y1 || ey < y0) {
          $dropZone.removeClass('active');
        }
        break;
      case 'drop':
        $dropZone.removeClass('active');

        if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
          var params = {
            files: event.dataTransfer.files,
            url: N.router.linkTo('users.media.upload', { album_id: pageParams.album_id }),
            config: 'users.uploader_config',
            uploaded: null
          };

          N.wire.emit('users.uploader:add', params, function () {
            $('#users-medias-list').prepend(
              $(N.runtime.render('users.album.list', { medias: params.uploaded, user_hid: pageParams.user_hid }))
            );
          });
        }
        break;
      default:
    }
  });
});

////////////////////////////////////////////////////////////////////////////////
// Create medialink button handler
//

N.wire.once('navigate.done:' + module.apiPath, function page_once() {

  N.wire.on('users.album:add_medialink', function add_medialink(event) {
    var params = { album_id: pageParams.album_id, providers: $(event.target).data('providers'), media: null };
    N.wire.emit('users.album.add_medialink', params, function () {
      $('#users-medias-list').prepend(
        $(N.runtime.render('users.album.list', { medias: [ params.media ], user_hid: pageParams.user_hid }))
      );
    });
  });
});


////////////////////////////////////////////////////////////////////////////////
// Lazy load photos on scroll down
//

var appendParams;


// Init photos append when user scroll page down
//
N.wire.after('navigate.done:' + module.apiPath, function setup_append(data) {
  appendParams = data.params;
});


N.wire.once('navigate.done:' + module.apiPath, function page_once() {

  // Append more photos
  //
  // If callback not executed, no new event happen
  //
  N.wire.on('users.album:append_more_medias', function append_more_medias(__, callback) {
    var $list = $('#users-medias-list');

    if (!$list.data('has-next-page')) {
      callback();
      return;
    }

    N.io.rpc(
      'users.album.list',
      {
        user_hid: appendParams.user_hid,
        album_id: appendParams.album_id,
        last_media_id: $list.find('li:last').data('media-id')
      }
    ).done(function (mediaList) {
      $list
        .data('has-next-page', mediaList.has_next_page)
        .data('last-media-id', mediaList.medias[mediaList.medias.length - 1].media_id)
        .append($(N.runtime.render('users.album.list', mediaList)));

      callback();
    });
  });
});
