'use strict';


var pageParams;


N.wire.on('navigate.done:' + module.apiPath, function setup_page(data) {
  pageParams = data.params;
});


var updateAlbumList = function () {
  N.io.rpc('users.albums_root.list', pageParams, function (err, albumsList) {
    if (err) { return false; }

    var $list = $(N.runtime.render('users.albums_root.list', albumsList));
    $('#users-albums-list').html($list);

    N.wire.emit('navigate.replace', {
      href: window.location.href,
      title: ''
    });
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
  var $dropZone, x0, y0, x1, y1, ex, ey, hid, id;

  switch (event.type) {
    case 'dragenter':
      $dropZone = $(event.target).closest('.user-album');
      $dropZone.addClass('active');
      break;
    case 'dragleave':
      // 'dragleave' occurs when user move cursor over child HTML element
      // track this situation and don't remove 'active' class
      // http://stackoverflow.com/questions/10867506/
      $dropZone = $(event.target).closest('.user-album');
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
      $dropZone = $(event.target).closest('.user-album');
      $dropZone.removeClass('active');

      id = $dropZone.data('albumId');
      hid = $dropZone.data('userHid');

      if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
        N.wire.emit('users.uploader:add', {
          files: event.dataTransfer.files,
          url: N.runtime.router.linkTo('users.media.upload', { user_hid: hid, album_id: id })
        }, updateAlbumList);
      }
      break;
    default:
  }
});
