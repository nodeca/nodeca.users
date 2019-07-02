'use strict';


const ScrollableList = require('nodeca.core/lib/app/scrollable_list');


// Page state
//
// - type:               tab type (forum, blogs, etc)
//
let pageState = {};
let scrollable_list;


function load(start, direction) {
  if (direction !== 'bottom') return null;

  return N.io.rpc('users.tracker.list.after', {
    type:  pageState.type,
    start
  }).then(res => {
    return {
      $html: $(N.runtime.render('users.tracker.items', res)),
      locals: res,
      reached_end: res.reached_end
    };
  });
}


N.wire.on('navigate.done:' + module.apiPath, function nav_tracker_tab_activate() {
  $('.navbar').find('[data-api-path="users.tracker"]').addClass('active');

  pageState.type               = N.runtime.page_data.tracker_type;
  pageState.reached_end        = !N.runtime.page_data.tracker_next;
  pageState.next_loading_start = 0;
  pageState.bottom_marker      = N.runtime.page_data.tracker_next;

  let navbar_height = parseInt($('body').css('margin-top'), 10) + parseInt($('body').css('padding-top'), 10);

  // account for some spacing between posts
  navbar_height += 32;

  scrollable_list = new ScrollableList({
    N,
    list_selector:               '.user-tracker-items',
    item_selector:               '.user-tracker-item',
    placeholder_bottom_selector: '.user-tracker__loading-next',
    get_content_id:              item => $(item).data('last-ts'),
    load,
    reached_top:                 true,
    reached_bottom:              N.runtime.page_data.reached_end,
    navbar_height
  });
});


N.wire.on('navigate.exit:' + module.apiPath, function page_teardown() {
  scrollable_list.destroy();
  scrollable_list = null;
});
