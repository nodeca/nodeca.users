// Get IP info for dialog message
//

'use strict';


const promisify = require('util').promisify;
const reverse = promisify(require('dns').reverse);
const whois   = promisify(require('whois').lookup);


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    message_id: { format: 'mongo', required: true }
  });


  // Check permissions
  //
  N.wire.before(apiPath, async function check_permissions(env) {
    let can_see_ip = await env.extras.settings.fetch('can_see_ip');

    if (!can_see_ip) throw N.io.FORBIDDEN;
  });


  // Fetch message IP
  //
  N.wire.on(apiPath, async function fetch_message_ip(env) {
    let dlg_message = await N.models.users.DlgMessage.findById(env.params.message_id)
                                .select('ip')
                                .lean(true);

    if (!dlg_message) throw N.io.NOT_FOUND;

    if (!dlg_message.ip) {
      throw {
        code: N.io.CLIENT_ERROR,
        message: env.t('err_no_ip')
      };
    }

    env.res.ip = env.data.ip = dlg_message.ip;
  });


  // Fetch whois info
  //
  N.wire.after(apiPath, async function fetch_whois(env) {
    let data = await whois(env.data.ip);

    env.res.whois = data.replace(/\r?\n/g, '\n')
                        .replace(/^[#%].*/mg, '')     // comments
                        .replace(/^\s+/g, '')         // empty head
                        .replace(/\s+$/g, '')         // empty tail
                        .replace(/[ ]+$/mg, '')       // line tailing spaces
                        .replace(/\n{2,}/g, '\n\n');  // doble empty lines
  });


  // Reverse resolve hostname
  //
  N.wire.after(apiPath, async function reverse_resolve(env) {

    try {
      // this error is not fatal
      let hosts = await reverse(env.data.ip);

      if (hosts.length) {
        env.res.hostname = hosts[0];
      }
    } catch (__) {}
  });
};
