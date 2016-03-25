// Emit penalty event if user reach enough points
//
'use strict';


const _ = require('lodash');


module.exports = function (N, apiPath) {

  N.wire.on(apiPath, function* infraction_penalty_add(infraction) {
    // Rules sorted by `points` in desc order
    let rules = (N.config.users.infractions.penalties || []).sort((a, b) => b.points - a.points);

    let infractions = yield N.models.users.Infraction.find()
                                .where('for').equals(infraction.for)
                                .where('exists').equals(true)
                                .or([ { expire: null }, { expire: { $gt: Date.now() } } ])
                                .select('points')
                                .lean(true);

    let total_points = _.sumBy(infractions, 'points');
    let apply_rule;

    // Find rule with maximum points
    for (let i = 0; i < rules.length; i++) {
      if (rules[i].points <= total_points) {
        apply_rule = rules[i];
        break;
      }
    }

    if (!apply_rule) return;

    return N.wire.emit(`internal:users.infraction.${apply_rule.action}`, {
      infraction,
      action_data: apply_rule.action_data
    });
  });
};
