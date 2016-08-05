
'use strict';


// Mark announces as dismissed
//
N.wire.on(module.apiPath + ':hide', function hide_announce(data) {
  return N.io.rpc('users.announces.hide', {
    announceid: data.$this.data('announce-id')
  }).catch(() => {
    // At this point of time the alert is already closed by bootstrap.
    // So we don't show the rpc error to the user (since alert is gone),
    // and the alert will just reappear on the next page.
  });
});
