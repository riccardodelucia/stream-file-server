import winston from 'winston';
import { AppError } from '../utils/appError.js';
import config from '../config.js';
import Joi from 'joi';

const { NODE_ENV } = config;

const logger = winston.createLogger({
  transports: [new winston.transports.Console()],
});

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    error: err,
    status: err.status,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err, res) => {
  // only operational errors should reveal error details to the client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    logger.error('Unexpected Internal Error: ', err);
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong',
    });
  }
};

const handleTokenExpiredError = () => {
  return new AppError('Token expired', 403);
};

const handleTokenInvalidClaimError = (error) => {
  return new AppError(
    `Invalid Token Claim. Wrong claims: '${error.claim}'`,
    403
  );
};

const handleDuplicateFieldDB = (error) => {
  const field = error.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  return new AppError(
    `Duplicate field value: ${field}. Please use another value`,
    400
  );
};

const handleNoSuchKeyError = (error) => {
  return new AppError(`Object ${error.Key} not found`, 404);
};

const handleValidationError = (error) => {
  return new AppError(
    `Validation error: ${error.error.details[0].message}`,
    422
  );
};

export default {
  globalErrorMiddleware: (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    let parsedError = null;
    if (err.name === 'JWTExpired') parsedError = handleTokenExpiredError();
    if (err.name === 'JWTClaimValidationFailed')
      parsedError = handleTokenInvalidClaimError(err);
    if (err.code === 11000) parsedError = handleDuplicateFieldDB(err);
    if (err.name === 'NoSuchKey') parsedError = handleNoSuchKeyError(err);
    if (err.error instanceof Joi.ValidationError)
      parsedError = handleValidationError(err);

    const error = parsedError ? parsedError : err;

    if (NODE_ENV === 'development') {
      sendErrorDev(error, res);
    } else if (NODE_ENV === 'production') {
      sendErrorProd(error, res);
    }
    return next(err);
  },
};
