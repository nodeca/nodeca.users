// Generate a quote wrapper that links to user profile
//

'use strict';


let render = require('nodeca.core/lib/system/render/common');


module.exports = function (N, apiPath) {

  N.wire.on(apiPath, async function generate_quote_wrapper(data) {
    if (data.html) return;

    let match = N.router.matchAll(data.url).reduce(function (acc, match) {
      return match.meta.methods.get === 'users.member' ? match : acc;
    }, null);

    if (!match) return;

    let user = await N.models.users.User
                         .findOne({ hid: match.params.user_hid, exists: true })
                         .lean(true);
    if (!user) return;

    let locals = { user };

    data.html = render(N, 'common.blocks.markup.quote', locals, {});
  });
};
