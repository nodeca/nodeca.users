'use strict';

// A delay after failed xhr request (delay between successful requests
// is set with affix `throttle` argument)
//
// For example, suppose user continuously scrolls. If server is up, each
// subsequent request will be sent each 100 ms. If server goes down, the
// interval between request initiations goes up to 2000 ms.
//
const LOAD_AFTER_ERROR = 2000;


// State of prefetch
// - type:               tab type (forum, blogs, etc)
// - reached_end:        true if no more results exist below last loaded result
// - next_loading_start: time when current xhr request for the next page is started
// - bottom_marker:      offset of the last loaded result
//
let pageState = {};

N.wire.on('navigate.done:' + module.apiPath, function nav_tracker_tab_activate() {
  $('.navbar').find('[data-api-path="users.tracker"]').addClass('active');

  pageState.type               = N.runtime.page_data.tracker_type;
  pageState.reached_end        = !N.runtime.page_data.tracker_next;
  pageState.next_loading_start = 0;
  pageState.bottom_marker      = N.runtime.page_data.tracker_next;
});


// Fetch more results when user scrolls down
//
N.wire.on(module.apiPath + ':load_next', function load_next() {
  if (pageState.reached_end) return;

  let now = Date.now();

  // `next_loading_start` is the last request start time, which is reset to 0 on success
  //
  // Thus, successful requests can restart immediately, but failed ones
  // will have to wait `LOAD_AFTER_ERROR` ms.
  //
  if (Math.abs(pageState.next_loading_start - now) < LOAD_AFTER_ERROR) return;

  pageState.next_loading_start = now;

  N.io.rpc('users.tracker.list.after', {
    type:  pageState.type,
    start: pageState.bottom_marker
  }).then(function (res) {
    pageState.reached_end = !res.next;
    pageState.bottom_marker = res.next;

    // if last search result is loaded, hide bottom placeholder
    if (pageState.reached_end) {
      $('.user-tracker__loading-next').addClass('d-none');
    }

    // reset lock
    pageState.next_loading_start = 0;

    $('.user-tracker-items').append(N.runtime.render('users.tracker.items', res));
  }).catch(err => {
    N.wire.emit('error', err);
  });
});
