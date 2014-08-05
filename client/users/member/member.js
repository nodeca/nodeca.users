'use strict';


N.wire.on('users.member:change_avatar', function change_avatar() {
  N.wire.emit('users.member.change_avatar', {}, function () {

  });
});
