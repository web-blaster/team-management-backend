import { Router } from 'express';
import { Role } from '../../constants/roles.js';
import { authenticate, authorize, validate } from '../../middleware/index.js';
import { asyncHandler } from '../../utils/core.js';
import { userController } from './user.controller.js';
import { invitationCreateSchema,userParamsSchema,userRolesSchema,userStatusSchema } from './user.validation.js';

const router=Router(); router.use(authenticate);
router.get('/',authorize(Role.ADMIN),asyncHandler(userController.list));
router.get('/:userId/profile',authorize(Role.MANAGER,Role.ADMIN),validate(userParamsSchema,'params'),asyncHandler(userController.profile));
router.patch('/:userId/status',authorize(Role.ADMIN),validate(userParamsSchema,'params'),validate(userStatusSchema),asyncHandler(userController.changeStatus));
router.put('/:userId/roles',authorize(Role.ADMIN),validate(userParamsSchema,'params'),validate(userRolesSchema),asyncHandler(userController.replaceRoles));
router.post('/invitations',authorize(Role.ADMIN),validate(invitationCreateSchema),asyncHandler(userController.invite));
export default router;
