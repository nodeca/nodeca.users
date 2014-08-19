// Member page
//

'use strict';


// Click to avatar
//
N.wire.on('users.member:change_avatar', function change_avatar() {
  N.wire.emit('users.avatar_change', {}, function () {
    window.location.reload(); // TODO
  });
});


// Click to delete avatar button
//
N.wire.on('users.member:detete_avatar', function change_avatar() {
  N.io.rpc('users.member.avatar.delete').done(function () {
    window.location.reload(); // TODO
  });
});
