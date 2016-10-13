const passport = require('koa-passport'),
      http = require('passport-http'),
      jwt = require('passport-jwt'),
      pathToRegexp = require('path-to-regexp');


function defaultHandler(...args) {
  throw new Error('Authentication handler is not implemented.');
}


exports.passport = passport;
exports.methods = [];
exports.ignores = [];
exports.handlers = {
  'basic': defaultHandler,
  'digest': defaultHandler,
  'oauth1.0': defaultHandler,
  'oauth2.0': defaultHandler,
  'pathThrough': defaultHandler,
  'jwt': defaultHandler,
  'xOther': defaultHandler
}


exports.middleware = function() {
  return function*(next) {
    if (exports.methods.length === 0) return yield* next;

    // Ignore pathes.
    for (ignore of exports.ignores) {
      let pattern = pathToRegexp(ignore);
      if (pattern.test(this.request.path)) return yield* next;
    }

    function* callback(err, user, info, status) {
      if (user === false) this.throw('Unauthorized', 401);
      return yield* next;
    }
    yield passport.authenticate(exports.methods, callback.bind(this)).call(this, next);
  }
}


const registerStrategyFunctions = {
  'Basic Authentication': function() {
    passport.use(new http.BasicStrategy(function(...args) {
      return exports.handlers.basic.apply(this, args);
    }));
    exports.methods.push('basic');
  },

  'Digest Authentication': function() {
    passport.use(new http.DigestStrategy({ qop: 'auth' }, function(...args) {
      return exports.handlers.digest.apply(this, args);
    }));
    exports.methods.push('digest');
  },

  'x-jwt': function() {
    const opts = {};
    opts.jwtFromRequest = jwt.ExtractJwt.fromAuthHeader();
    opts.secretOrKey = 'secret';
    passport.use(new jwt.Strategy(opts, function(...args) {
      return exports.handlers.jwt.apply(this, args);
    }));
    exports.methods.push('jwt');
  }
}


// HACKME: もっと頑張れる
exports.load = function(raml) {
  const securities = raml.securitySchemes().map(function(s) { return s.toJSON(); });

  for (type of raml.securedBy()) {
    let security = getSecurityScheme(type.toJSON(), securities);
    if (!security) throw new Error(`The method name "${method}" is not found.`);

    const fn = registerStrategyFunctions[security.type];
    if (!fn) throw new Error(`${security.type} is not implemented.`);

    fn();
  }
}


function getSecurityScheme(method, securities) {
  for (security of securities) {
    if (security[method]) return security[method];
  }
  return undefined;
}