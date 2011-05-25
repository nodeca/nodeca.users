var Controller = require('express-railer').Controller;


var UsersController = function UsersController(app) {
  Controller.apply(this);


  this.login = function login_action(req, res, next) {
  };


  this.logout = function logout_action(req, res, next) {
  };
};


Controller.adopts(UsersController).export(module);


// vim:et:ts=2:sw=2
