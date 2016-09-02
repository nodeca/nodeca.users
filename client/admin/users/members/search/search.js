'use strict';


const _ = require('lodash');

let reached_end;
let next_loading_start;
let search_query;
let result_count;


N.wire.on('navigate.done:' + module.apiPath, function init_handlers() {
  reached_end        = $('.member-search-results').data('reached-end');
  search_query       = $('.member-search-results').data('search-query');
  result_count       = $('.member-search-results').data('result-count');
  next_loading_start = 0;
});


// Init handlers
//
N.wire.once('navigate.done:' + module.apiPath, function init_handlers() {
  // A delay after failed xhr request (delay between successful requests
  // is set with affix `throttle` argument)
  //
  const LOAD_AFTER_ERROR = 2000;

  // An amount of rows to fetch in each query
  //
  const LOAD_COUNT = 50;

  N.wire.on(module.apiPath + ':load_next', function load_next_page() {
    if (reached_end) return;

    let now = Date.now();

    // `next_loading_start` is the last request start time, which is reset to 0 on success
    //
    // Thus, successful requests can restart immediately, but failed ones
    // will have to wait `LOAD_AFTER_ERROR` ms.
    //
    if (Math.abs(next_loading_start - now) < LOAD_AFTER_ERROR) return;

    next_loading_start = now;

    N.io.rpc('admin.users.members.search.list', _.assign({
      skip:   result_count,
      limit:  LOAD_COUNT
    }, search_query)).then(function (res) {
      if (!res.search_results) return;

      if (res.search_results.length !== LOAD_COUNT) {
        reached_end = true;
      }

      if (res.search_results.length === 0) return;

      result_count += res.search_results.length;

      // render & inject topics list
      let $result = $(N.runtime.render('admin.users.members.search.results', res));
      $('.member-search-results').append($result);

      // Workaround for FF bug, possibly this one:
      // https://github.com/nodeca/nodeca.core/issues/2
      //
      // When user scrolls down and we insert content to the end
      // of the page, and the page is large enough (~1000 topics
      // or more), next scrollTop() read on 'scroll' event may
      // return invalid (too low) value.
      //
      // Reading scrollTop in the same tick seem to prevent this
      // from happening.
      //
      $(window).scrollTop();

      // reset lock
      next_loading_start = 0;
    }).catch(err => {
      N.wire.emit('error', err);
    });
  });
});
