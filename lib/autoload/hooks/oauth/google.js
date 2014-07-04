// Hook for google oauth. Sets url params and define parser

'use strict';

var revalidator = require('revalidator');
var OAuth = require('oauth');

// Users data scheme
var GOOGLE_SCHEMA = {
  emails : {
    type: 'array',
    required: true,
    minLength: 1,
    email : {
      type: 'string',
      required: true ,
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

module.exports = function (N) {

  var url = 'https://accounts.google.com';
  var path = '/o/oauth2/token';
  var get_url = 'https://www.googleapis.com/plus/v1/people/me';


  N.wire.on('server:users.auth.oauth.callback', function oauth_google_requests(env, callback) {

    // Process only google provider
    if (env.params.provider !== 'google') {
      callback();
      return;
    }

    var client = N.config.oauth[env.params.provider].client;
    var secret = N.config.oauth[env.params.provider].secret;

    var oauth2 = new OAuth.OAuth2(client, secret, url, null, path, null);

    // Get token
    oauth2.getOAuthAccessToken(
      env.params.code,
      {
        'grant_type':'authorization_code',
        'redirect_uri' : N.runtime.router.linkTo('users.auth.oauth.callback', { provider: env.params.provider })
      },
      function (err, access_token){
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
          var res = revalidator.validate(provider_data, GOOGLE_SCHEMA);
          if (!res.valid) {
            callback('OAuth error. Validation error data from google provider. ' + res.errors);
            return;
          }

          env.data.oauth = {
            'provider': env.params.provider,
            'data': {
              'email': provider_data.emails[0].value,  // TODO: Find case with multiple emails
              'provider_user_id': provider_data.id,
              'meta' :{
                'first_name': provider_data.name.givenName,
                'last_name': provider_data.name.familyName
              }
            }
          };

          callback();
        });
      });
  });


};
