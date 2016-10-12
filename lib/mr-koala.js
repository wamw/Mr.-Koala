const koa = require('koa'),
      route = require('koa-route'),
      bodyParser = require('koa-bodyparser'),
      raml = require('raml-1-parser'),
      requireDirectory = require('require-directory'),
      schemas = require('./schema.js'),
      resources = require('./resource.js'),
      passport = require('koa-passport'),
      basicStrategy = require('passport-http').BasicStrategy;


const koala = module.exports = function(filepath, options) {
  // Load RAML File
  const spec = raml.loadRAMLSync(filepath);

  // Create App
  const app = koa();

  // Middlewares
  passport.use(new basicStrategy(
    function(username, password, cb) {
      if (username === 'hoge' && password === 'fuga') {
        return cb(null, {name: 'ohtani'});
      }
      return cb(null, false);
    }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(function*(next) {
    var context = this;
    yield passport.authenticate('basic', function*(err, user, info, status) {
      if (user === false) {
        context.throw('Error Messageeeeeeeeeeeee', 401);
      }
      return yield* next;
    }).call(this, next);
  });
  app.use(bodyParser());
  app.use(function*(next){
    try {
      yield next;
    } catch (err) {
      this.status = err.status || 500;
      this.body = {
        status: this.status,
        cause: err.name,
        message: err.message,
        errors: err.errors
      };
    }
  });

  // TODO: Build app from RAML
  schemas.load(spec.schemas());
  resources.load(spec.allResources());

  const resourcesDir = options.resources;
  if (resourcesDir) requireDirectory(module, resourcesDir);

  for (let r of resources) {
    app.use(createHandler(r.path, r.method, r.class));
  }

  return app;
}


koala.resources = resources;


function createHandler(path, method, resource) {
  return route[method](path, function *(...args) {
    const next = args.pop();

    const r = new resource(this, args);

    // Resolve uri params
    r.params = yield* r.resolve(this, args);

    // Validate request params
    yield* r.query(this);

    // Validate request body
    yield* r.request(this, this.request.body);

    // Generate response body
    this.body = yield* r.response(this);

    return yield* next;
  })
}