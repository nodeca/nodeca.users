'use strict';

var CACHE     = {};
var CACHE_TTL = 5 * 60 * 1000; // time in ms

function now() {
  return (new Date()).getTime();
}



function getUserInfo(id, callback) {
  if (CACHE[id] && CACHE_TTL > (CACHE[id].ts - now())) {
    callback(CACHE[id]);
    return;
  }

  nodeca.io.apiTree('users.card', { id: id }, function (err, resp) {
    callback(CACHE[id] = { ts: now(), user: (resp.data || {}).user });
  });
}


module.exports = function active_profiles() {
  $('body').on('mouseenter.nodeca.data-api', 'a[data-user-id]', function (event) {
    var $this = $(this), card = $this.data('user-card');

    getUserInfo($this.data('user-id'), function (data) {
      if (!data.user) {
        // no user -- do not do anything
        return;
      }

      if (!card) {
        $this.powerTip({ smartPlacement: true, mouseOnToPopup: true });
      }

      if (card !== data.ts) {
        $this.data('user-card', data.ts);
        $this.data('powertip',  nodeca.client.common.render('common.widgets.active_profile', data.user));
        $.powerTip.showTip($this);
      }
    });
  });
};
