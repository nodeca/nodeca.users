// Start resolving location name for a given user
//
// In:
//  - redis zset `geo:member` (`user_id:locale` => timestamp)
//

'use strict';


// time delay before location resolution, used to prevent multiple requests
// caused by "submit" button spam
const RESOLVE_DELAY = 5000;


module.exports = function (N) {
  N.wire.on('init:jobs', function register_geo_member_location_process() {
    N.queue.registerTask({
      name: 'geo_member_location_process',

      postponeDelay: RESOLVE_DELAY,

      async process() {
        let range_end = Date.now() - RESOLVE_DELAY;

        // data format: `user_id:locale`
        let res = await N.redis.multi()
                            .zrangebyscore('geo:member', '-inf', range_end)
                            .zremrangebyscore('geo:member', '-inf', range_end)
                            .exec();

        for (let userid_locale of res[0][1]) {
          let [ user_id, locale ] = userid_locale.split(':', 2);

          let user = await N.models.users.User.findById(user_id).lean(true);

          if (!user || !user.location) continue;

          // request location names, triggering name resolution;
          // `true` means high priority
          await N.models.core.Location.info([ user.location ], locale, true);
        }
      }
    });
  });
};
