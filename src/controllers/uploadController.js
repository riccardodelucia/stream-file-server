import Busboy from 'busboy';
import PQueue from 'p-queue';
import winston from 'winston';

import publisher from '../publisher.js';
import { multipartUpload, checkObjectExistence } from '../s3.js';
import { AppError } from '../utils/appError.js';

import { catchAsync } from '../utils/catchAsync.js';

const logger = winston.createLogger({
  transports: [new winston.transports.Console()],
});

export default {
  validateNewObjectKeyUpload: catchAsync(async (req, res, next) => {
    // we check whether the uploading object key already corresponds to an uploaded object
    const objectKey = req.headers['x-object-key'];
    res.locals.objectKey = objectKey;

    const objectExists = await checkObjectExistence(objectKey);
    if (objectExists)
      return next(
        new AppError(`ObjectKey ${objectKey} already exists`, 403, req)
      );
    return next();
  }),
  uploadFile: (req, res, next) => {
    /**
     * Since Busboy rreceives here a header of Content-Type: multipart/form-data, I cannot set the uploaded file type from the request.
     * This means the uploaded files on s3 inherit the standard type, which is octet-stream. When downloading files, I cannot retrieve the file type from the s3 downloaded object file. Therefore, I need a specific strategy for inferring the file type in the download controller.
     */
    const objectKey = res.locals.objectKey;

    const busboy = Busboy({ headers: req.headers });
    const sequentialQueue = new PQueue({ concurrency: 1 });

    async function executeSequentiallyAbortOnError(fn) {
      sequentialQueue.add(async () => {
        try {
          await fn();
        } catch (error) {
          req.unpipe(busboy);
          next(error);
        }
      });
    }

    busboy.on('file', (_, file, fileInfo) => {
      executeSequentiallyAbortOnError(async () => {
        const filename = fileInfo.filename;
        res.locals.filename = filename;
        await multipartUpload(file, objectKey);
      });
    });

    busboy.on('finish', () => {
      res.status(201).json({
        status: 'success',
        data: {
          objectKey,
        },
      });
      return next();
    });

    req.on('aborted', () => {
      logger.error('Connection aborted by the user');
      req.unpipe(busboy);
      sequentialQueue.pause();
      //return next(new AppError('Connection aborted', 499));
    });

    busboy.on('error', (err) => {
      // this function is probably never called due to executeSequentiallyAbortOnError for event 'file'
      req.unpipe(busboy);
      sequentialQueue.pause();
      return next(err);
    });

    req.pipe(busboy);
  },
  publishUploadedMsg: async (req, res, next) => {
    // Note: since this is an after response handler, we don't need catchAsync to manage error responses
    const filename = res.locals.filename;
    const objectKey = res.locals.objectKey;

    try {
      console.info(
        `Publishing object uploaded message for object: ${objectKey}`
      );
      await publisher.publishUploadedMsg(filename, objectKey);
      return next();
    } catch (error) {
      logger.error('error while publishing message');
      logger.error(error);
    }
  },
  publishErrorMsg: async (err, req, res, next) => {
    // Note: since this is an after response handler, we don't need catchAsync to manage error responses
    const filename = res.locals.filename;
    const objectKey = res.locals.objectKey;

    try {
      console.info(`Publishing error message for object: ${objectKey}`);
      await publisher.publishErrorMsg(filename, objectKey);
      return next(err);
    } catch (error) {
      logger.error('error while publishing message');
      logger.error(error);
    }
  },
  closeConnectionOnError: (err, req, res, next) => {
    //this instruction automatically closes the socket with the client -> it allows to interrupt file uploads from the client browser
    res.header('Connection', 'close');
    return next(err);
  },
};
