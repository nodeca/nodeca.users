'use strict';

var _ = require('lodash');

var pageParams;
var isOnPage;


N.wire.on('navigate.done:' + module.apiPath, function setup_page(data) {
  pageParams = data.params;
  isOnPage = true;
});


N.wire.on('navigate.exit:' + module.apiPath, function teardown_page() {
  isOnPage = false;
});


var updateAlbumList = function (albumId) {
  // Check user still on page
  if (!isOnPage) {
    return;
  }

  N.io.rpc('users.albums_root.list', pageParams).done(function (albumsList) {
    var $listContainer = $('.user-albumlist');

    if (albumId) {
      albumsList.albums = _.filter(albumsList.albums, { _id: albumId });

      $listContainer.find('[data-album-id=' + albumId + ']').replaceWith(
        $(N.runtime.render('users.albums_root.list', albumsList))
      );
    } else {
      $listContainer.html($(N.runtime.render('users.albums_root.list', albumsList)));
    }

    N.wire.emit('navigate.replace', {});
  });
};


// Reload album list when album successful created
//
N.wire.on('users.album.create:done', function update_list() {
  updateAlbumList();
});


// Handles the event when user drag file to album
//
N.wire.on('users.albums_root.list:dragdrop', function albums_root_dd(event) {
  var $dropZone, x0, y0, x1, y1, ex, ey, id;

  switch (event.type) {
    case 'dragenter':
      $dropZone = $(event.target).closest('.user-albumlist__item');
      $dropZone.addClass('active');
      break;
    case 'dragleave':
      // 'dragleave' occurs when user move cursor over child HTML element
      // track this situation and don't remove 'active' class
      // http://stackoverflow.com/questions/10867506/
      $dropZone = $(event.target).closest('.user-albumlist__item');
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
      $dropZone = $(event.target).closest('.user-albumlist__item');
      $dropZone.removeClass('active');

      id = $dropZone.data('albumId');

      if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
        N.wire.emit('users.uploader:add', {
          files: event.dataTransfer.files,
          url: N.router.linkTo('users.media.upload', { album_id: id }),
          config: 'users.uploader_config'
        }, function () {
          updateAlbumList(id);
        });
      }
      break;
    default:
  }
});
