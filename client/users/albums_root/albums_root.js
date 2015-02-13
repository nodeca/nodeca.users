'use strict';

var _ = require('lodash');

var pageParams;


N.wire.on('navigate.done:' + module.apiPath, function page_setup(data) {
  pageParams = data.params;
});


N.wire.once('navigate.done:' + module.apiPath, function page_once() {

  var updateAlbumList = function (albumId) {
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
    });
  };


  // Create album button handler
  //
  N.wire.on('users.albums_root.create_album', function update_list() {
    var params = { album: null };

    N.wire.emit('users.album.create', params, function () {
      if (params.album) {
        updateAlbumList();
      }
    });
  });


  // Handles the event when user drag file to album
  //
  N.wire.on('users.albums_root.list:dragdrop', function albums_root_dd(data) {
    var $dropZone, x0, y0, x1, y1, ex, ey, id;

    switch (data.event.type) {
      case 'dragenter':
        $dropZone = data.$this.closest('.user-albumlist__item');
        $dropZone.addClass('active');
        break;
      case 'dragleave':
        // 'dragleave' occurs when user move cursor over child HTML element
        // track this situation and don't remove 'active' class
        // http://stackoverflow.com/questions/10867506/
        $dropZone = data.$this.closest('.user-albumlist__item');
        x0 = $dropZone.offset().left;
        y0 = $dropZone.offset().top;
        x1 = x0 + $dropZone.outerWidth();
        y1 = y0 + $dropZone.outerHeight();
        ex = data.event.originalEvent.pageX;
        ey = data.event.originalEvent.pageY;

        if (ex > x1 || ex < x0 || ey > y1 || ey < y0) {
          $dropZone.removeClass('active');
        }
        break;
      case 'drop':
        $dropZone = data.$this.closest('.user-albumlist__item');
        $dropZone.removeClass('active');

        id = $dropZone.data('albumId');

        if (data.event.dataTransfer && data.event.dataTransfer.files && data.event.dataTransfer.files.length) {
          N.wire.emit('users.uploader:add', {
            files: data.event.dataTransfer.files,
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
});
