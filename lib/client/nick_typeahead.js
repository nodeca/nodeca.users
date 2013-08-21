// Helper to initalize user nick input autocompletion.


'use strict';


// FIXME: We must replace this with with debounce function from Lodash as soon
// as Nodeca's bundler will allow "requires" in vendor modles such this.
//
// This is debounce implementation from MoutJS available under MIT license.
// Copyright (c) 2012, 2013 moutjs team and contributors (http://moutjs.com)
//
function debounce(fn, threshold, isAsap){
  var timeout, result;
  var debounced = function (){
    var args = arguments, context = this;
    function delayed(){
      if (! isAsap) {
        result = fn.apply(context, args);
      }
      timeout = null;
    }
    if (timeout) {
      clearTimeout(timeout);
    } else if (isAsap) {
      result = fn.apply(context, args);
    }
    timeout = setTimeout(delayed, threshold);
    return result;
  };
  debounced.cancel = function(){
    clearTimeout(timeout);
  };
  return debounced;
}


var USER_LOOKUP_DELAY = 200;


module.exports = function nick_typeahead(element) {
  $(element).typeahead({
    minLength: 1
  , source: debounce(function (query, process) {
      var self = this;

      N.io.rpc('admin.core.user_lookup', { nick: query }, function (err, res) {
        if (err) {
          return false; // Invoke standard error handling.
        }

        self.lastSourceData = {};

        res.users.forEach(function (user) {
          self.lastSourceData[user.nick] = user;
        });

        process(res.users.map(function (user) { return user.nick; }));
      });
    }, USER_LOOKUP_DELAY)
  , matcher: function () {
      // Server method only returns appropriate users.
      return true;
    }
  , highlighter: function (item) {
      // Show full name in popup list.
      return this.lastSourceData[item].name;
    }
  });
};
