import express from 'express';

import Joi from 'joi';
import { createValidator } from 'express-joi-validation';

import downloadController from '../controllers/downloadController.js';
import authController from '../controllers/authController.js';

import config from '../config.js';

const { PROTECTED } = config;

const router = express.Router({ mergeParams: true });

const querySchema = Joi.object({
  'object-key': Joi.string().required(),
});

const validator = createValidator({ passError: true });

let middlewareChain = [validator.query(querySchema)];

if (PROTECTED) {
  router.use(authController.protect);
  middlewareChain = middlewareChain.concat(
    authController.validateObjectKeyAgainstUser
  );
}

middlewareChain = middlewareChain.concat(downloadController.downloadFile);

router.get('/', ...middlewareChain);

export default router;
