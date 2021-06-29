// Allow any user to subscribe to any channel in `private.member.#{user_id}` namespace
//
'use strict';


module.exports = function (N) {
  N.wire.on('internal.live.subscribe:private.member.*', async function member_subscribe(data) {
    let user_info = await data.getUserInfo();
    if (!user_info) return;

    let match = data.channel.match(/^private\.member\.([0-9a-f]{24})\./);

    if (match?.[1] && match[1] === user_info.user_id) data.allowed = true;
  });
};
