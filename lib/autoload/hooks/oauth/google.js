// Hook for google oauth. Sets url params and define parser
//
'use strict';


const validator = require('is-my-json-valid');
const OAuth     = require('oauth');


// Users data scheme
const GOOGLE_SCHEMA = {
  emails : {
    type: 'array',
    required: true,
    minLength: 1,
    email : {
      type: 'string',
      required: true,
      minLength: 1
    }
  },
  id : {
    type: 'string',
    required: true,
    minLength: 1
  },
  name : {
    type: 'object',
    required: true,
    givenName : {
      type: 'string'
    },
    familyName : {
      type: 'string'
    }
  },
  additionalProperties: true
};

const validate = validator(GOOGLE_SCHEMA, { verbose: true });


module.exports = function (N) {

  const url = 'https://accounts.google.com';
  const path = '/o/oauth2/token';
  const get_url = 'https://www.googleapis.com/plus/v1/people/me';


  N.wire.before('server:users.auth.oauth.callback', function oauth_google_requests(env, callback) {

    // Process only google provider
    if (env.params.provider !== 'google') {
      callback();
      return;
    }

    let client = N.config.oauth.google.client;
    let secret = N.config.oauth.google.secret;

    let oauth2 = new OAuth.OAuth2(client, secret, url, null, path, null);

    // Get token
    oauth2.getOAuthAccessToken(
      env.params.code,
      {
        grant_type:   'authorization_code',
        redirect_uri: N.router.linkTo('users.auth.oauth.callback', { provider: env.params.provider })
      },
      function (err, access_token) {
        if (err) {
          callback(err);
          return;
        }

        // Get user info
        oauth2.get(get_url, access_token, function (err, data) {
          if (err) {
            callback(err);
            return;
          }

          var provider_data;

          try {
            provider_data = JSON.parse(data);
          } catch (e) {
            err = e;
          }

          // Error parsing JSON data from provider
          if (err) {
            callback(err);
            return;
          }

          // validate provider data
          if (!validate(provider_data)) {
            callback(`OAuth internal error, Google reply did not passed validation. (${validate.errors}).`);
            return;
          }

          env.data.oauth = {
            type:             env.params.provider,
            // TODO: Find case with multiple emails
            email:            provider_data.emails[0].value,
            provider_user_id: provider_data.id,
            meta: {
              first_name: provider_data.name.givenName,
              last_name: provider_data.name.familyName
            }
          };

          callback();
        });
      });
  });


};
