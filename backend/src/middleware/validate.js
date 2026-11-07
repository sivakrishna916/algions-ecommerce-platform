const { ZodError } = require('zod');
const { AppError } = require('../utils/AppError');

/** validate({ body, query, params }) — parsed (and stripped) values replace the originals. */
const validate = (schemas) => (req, _res, next) => {
  try {
    for (const part of ['params', 'query', 'body']) {
      if (schemas[part]) req[part] = schemas[part].parse(req[part] ?? {});
    }
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      return next(new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', details));
    }
    return next(err);
  }
};

module.exports = { validate };
