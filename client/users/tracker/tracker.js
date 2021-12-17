'use strict';


const ScrollableList = require('nodeca.core/lib/app/scrollable_list');


// Page state
//
// - type:         tab type (forum, blogs, etc)
// - mark_cut_ts:  date when this page was last updated (required for mark all read)
//
let pageState = {};
let scrollable_list;


function load(start, direction) {
  if (direction !== 'bottom') return null;

  return N.io.rpc('users.tracker.list.after', {
    type:  pageState.type,
    start
  }).then(res => {
    pageState.mark_cut_ts = res.mark_cut_ts;

    return {
      $html: $(N.runtime.render(`users.tracker.blocks.${pageState.type}`, res)),
      locals: res,
      reached_end: res.next === null
    };
  });
}


N.wire.on('navigate.done:' + module.apiPath, function nav_tracker_tab_activate() {
  $('.navbar').find('[data-api-path="users.tracker"]').addClass('show');

  pageState.type = N.runtime.page_data.tracker_type;
  pageState.mark_cut_ts = N.runtime.page_data.mark_cut_ts;

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


N.wire.on(module.apiPath + ':mark_all_read', function mark_all_read(data) {
  let marker_types = Array.from(new Set(data.$this.data('marker-types')));

  return N.io.rpc('users.tracker.mark_read', { marker_types, ts: pageState.mark_cut_ts })
             .then(() => N.wire.emit('navigate.reload'));
});


N.wire.on(module.apiPath + ':mark_tab_read', function mark_tab_read(data) {
  let marker_types = Array.from(new Set(data.$this.data('marker-types')));

  return N.io.rpc('users.tracker.mark_read', { marker_types, ts: pageState.mark_cut_ts })
             .then(() => N.wire.emit('navigate.reload'));
});
