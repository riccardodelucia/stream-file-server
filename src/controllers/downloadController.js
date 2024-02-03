import winston from 'winston';
import path from 'path';

import { download } from '../s3.js';

import { catchAsync } from '../utils/catchAsync.js';

const logger = winston.createLogger({
  transports: [new winston.transports.Console()],
});

export default {
  downloadFile: catchAsync(async (req, res) => {
    const objectKey = req.query['object-key'];

    const stream = await download(objectKey);

    // guessing mime type from file extension. Not the best solution maybe, could have been using Content-Type from the upload.
    let contentType = '';
    const ext = path.extname(objectKey).slice(1);
    switch (ext) {
      case 'json':
        contentType = 'application/json';
        break;
      case 'csv':
        contentType = 'text/csv';
        break;
      case 'tsv':
        contentType = 'text/csv';
        break;
      case 'pdf':
        contentType = 'application/pdf';
        break;
      case 'png':
        contentType = 'image/png';
        break;
      default:
        contentType = 'application/octet-stream';
        break;
    }
    logger.info(`Content type of ${objectKey}: ${contentType}`);

    res.setHeader('Content-Type', contentType);
    res.status(200);
    stream.pipe(res);
  }),
};
