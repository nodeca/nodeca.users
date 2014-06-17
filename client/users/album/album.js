'use strict';


var pageParams;


N.wire.on('navigate.done:' + module.apiPath, function setup_page(data) {
  pageParams = data.params;

  // Init uploader
  N.wire.emit('users.upload:init', {
    inputSelector: '#users-album__upload-files',
    uploadUrl: N.runtime.router.linkTo('users.media.upload', data.params),
    onDone: 'users.album:uploaded'
  });
});


N.wire.on('users.album:dragdrop', function (event) {
  var $target = $(event.target);
  switch (event.type) {
    case 'dragenter':
      $target.addClass('active');
      break;
    case 'dragleave':
      $target.removeClass('active');
      break;
    case 'drop':
      $target.removeClass('active');

      if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
        N.wire.emit('users.upload:add', event.dataTransfer.files);
      }
      break;
  }
});


// listen successful media upload & reload media list
//
N.wire.on('users.album:uploaded', function update_list() {
  N.io.rpc('users.media.list', pageParams, function (err, mediaList) {
    if (err) { return false; }

    var $list = $(N.runtime.render('users.media.list', mediaList));
    $('#users-medias-list').html($list);
  });
});
