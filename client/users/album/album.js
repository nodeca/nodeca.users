'use strict';


var pageParams;
var $dropZone;
var isOnPage;


var reloadAlbums = function () {
  // Check user still on page
  if (!isOnPage) {
    return;
  }

  N.io.rpc('users.album.media_list', pageParams, function (err, mediaList) {
    if (err) { return false; }

    var $list = $(N.runtime.render('users.album.media_list', mediaList));
    $('#users-medias-list').html($list);

    N.wire.emit('navigate.replace', {});
  });
};


N.wire.on('navigate.done:' + module.apiPath, function setup_page(data) {
  isOnPage = true;
  $dropZone = $('#users-album__upload');
  pageParams = data.params;

  $('#users-album__upload-files').on('change', function () {
    var files = $(this).get(0).files;
    if (files.length > 0) {
      N.wire.emit(
        'users.uploader:add',
        {
          files: files,
          url: N.runtime.router.linkTo('users.media.upload', pageParams),
          config: 'users.uploader_config'
        },
        reloadAlbums
      );
    }
  });
});


N.wire.on('navigate.exit:' + module.apiPath, function teardown_page() {
  isOnPage = false;
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
        N.wire.emit(
          'users.uploader:add',
          {
            files: event.dataTransfer.files,
            url: N.runtime.router.linkTo('users.media.upload', pageParams),
            config: 'users.uploader_config'
          },
          reloadAlbums
        );
      }
      break;
    default:
  }
});
