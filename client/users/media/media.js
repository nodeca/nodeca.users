'use strict';


N.wire.before('users.media:delete', function confirm_medialist_delete(event, callback) {
  N.wire.emit('common.blocks.confirm', t('delete_confirmation'), callback);
});


N.wire.on('users.media:delete', function medialist_delete(event) {
  var $target = $(event.target);
  var mediaId = $target.data('mediaId');
  var userHid = $target.data('userHid');
  var albumId = $target.data('albumId');

  N.io.rpc('users.media.destroy', { 'media_id': mediaId }, function (err) {
    if (err) { return false; }

    window.location = N.runtime.router.linkTo('users.album', { user_hid: userHid, album_id: albumId });
  });
});
