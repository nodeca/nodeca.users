'use strict';

var _ = require('lodash');


var pageParams;
var $dropZone;
var isOnPage;


var reloadMedia = function () {
  // Check user still on page
  if (!isOnPage) {
    return;
  }

  N.io.rpc('users.album.list', pageParams).done(function (mediaList) {
    var $list = $(N.runtime.render('users.album.list', mediaList));
    $('#users-medias-list').html($list);

    N.wire.emit('navigate.replace', {});
  });
};


////////////////////////////////////////////////////////////////////////////////
// Uploader
//


N.wire.on('navigate.done:' + module.apiPath, function setup_page(data) {
  isOnPage = true;
  $dropZone = $('.user-album-upload');
  pageParams = data.params;

  $('.user-album-upload__files').on('change', function () {
    var files = $(this).get(0).files;
    if (files.length > 0) {
      N.wire.emit(
        'users.uploader:add',
        {
          files: files,
          url: N.router.linkTo('users.media.upload', { album_id: pageParams.album_id }),
          config: 'users.uploader_config'
        },
        reloadMedia
      );
    }
  });
});


N.wire.on('users.album:select_files', function select_files() {
  $('.user-album-upload__files').click();
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
            url: N.router.linkTo('users.media.upload', { album_id: pageParams.album_id }),
            config: 'users.uploader_config'
          },
          reloadMedia
        );
      }
      break;
    default:
  }
});


////////////////////////////////////////////////////////////////////////////////
// Create medialink button handler
//


N.wire.on('users.album:add_medialink', function add_medialink (event) {
  var params = { album_id: pageParams.album_id, providers: $(event.target).data('providers') };
  N.wire.emit('users.album.add_medialink', params, reloadMedia);
});


////////////////////////////////////////////////////////////////////////////////
// Lazy load photos on scroll down
//

var nextPage;
var appendParams;


// Init photos append when user scroll page down
//
N.wire.after('navigate.done:' + module.apiPath, function setup_append(data) {
  appendParams = _.clone(data.params);

  if (!appendParams.album_id) {
    nextPage = 2;
  } else {
    nextPage = -1;
  }
});


// Append more photos
//
// If callback not executed, no new event happen
//
N.wire.on('users.album:append_more_photos', function append_more_photos (__, callback) {
  if (nextPage === -1) {
    // Skip callback to stop new attempts
    return;
  }

  N.io.rpc('users.album.list', _.assign({}, appendParams, { page: nextPage })).done(function (mediaList) {
    var $list = $(N.runtime.render('users.album.list', mediaList));
    $('#users-medias-list').append($list);

    if (mediaList.medias.length < mediaList.photos_per_page) {
      // No more available media
      nextPage = -1;
    } else {
      nextPage++;
    }

    callback();
  });
});
