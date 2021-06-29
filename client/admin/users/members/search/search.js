'use strict';


const ScrollableList = require('nodeca.core/lib/app/scrollable_list');

let scrollable_list;
let search_query;


function load(start, direction) {
  if (direction !== 'bottom') return null;

  return N.io.rpc('admin.users.members.search.list', Object.assign({
    start,
    limit: 100
  }, search_query)).then(function (res) {
    return {
      $html: $(N.runtime.render('admin.users.members.search.results', res)),
      locals: res,
      reached_end: res.reached_end
    };
  }).catch(err => {
    N.wire.emit('error', err);
  });
}


// Return sorting field, cast explicitly to string taking into account
// numeric nicknames
//
function get_content_id(item) {
  return String($(item).data(search_query.sort_by));
}


N.wire.on('navigate.done:' + module.apiPath, function init_handlers() {
  search_query = $('.members-search__results').data('search-query');

  scrollable_list = new ScrollableList({
    N,
    list_selector:               '.members-search__results',
    item_selector:               '.members-search__item',
    placeholder_bottom_selector: '.members-search__loading-next',
    get_content_id,
    load,
    reached_top:                 true,
    reached_bottom:              typeof $('.members-search__results').data('reached-end') !== 'undefined'
  });
});


N.wire.on('navigate.exit:' + module.apiPath, function page_teardown() {
  if (scrollable_list) scrollable_list.destroy();
  scrollable_list = null;
});
