import express from 'express';

import Joi from 'joi';
import { createValidator } from 'express-joi-validation';

import uploadController from '../controllers/uploadController.js';
import authController from '../controllers/authController.js';

import config from '../config.js';

const { PROTECTED, PUBLISHER } = config;

const router = express.Router({ mergeParams: true });

const headerSchema = Joi.object({
  'x-object-key': Joi.string().required(),
});

const validator = createValidator({ passError: true });

let middlewareChain = [
  validator.headers(headerSchema),
  uploadController.validateNewObjectKeyUpload,
];
let errorChain = [uploadController.closeConnectionOnError];

if (PROTECTED) {
  router.use(authController.protect);
}

middlewareChain = middlewareChain.concat(uploadController.uploadFile);

if (PUBLISHER) {
  middlewareChain = middlewareChain.concat(uploadController.publishUploadedMsg);
  errorChain = errorChain.concat(uploadController.publishErrorMsg);
}

router.post('/', ...middlewareChain, ...errorChain);

export default router;
