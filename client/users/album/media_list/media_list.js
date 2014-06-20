
'use strict';

N.wire.on('users.album.media_list:delete', function (event) {
  if (window.confirm(t('delete_confirmation'))) {
    N.io.rpc('users.media.destroy', { 'media_id': $(event.target).data('_id') }, function (err) {
      if (err) { return false; }

      // Emit event on success
      N.wire.emit('users.album:deleted_media');
    });
  }
});
