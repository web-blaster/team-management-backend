import { Router } from 'express';
import { authenticate, validate } from '../../middleware/index.js';
import { asyncHandler } from '../../utils/core.js';
import { authController } from './auth.controller.js';
import { registerSchema,loginSchema,invitationSchema,forgotPasswordSchema,resetPasswordSchema,changePasswordSchema } from './auth.validation.js';

const router=Router();
router.post('/register',validate(registerSchema),asyncHandler(authController.register));
router.post('/login',validate(loginSchema),asyncHandler(authController.login));
router.post('/refresh',asyncHandler(authController.refresh));
router.post('/logout',asyncHandler(authController.logout));
router.post('/forgot-password',validate(forgotPasswordSchema),asyncHandler(authController.forgotPassword));
router.post('/reset-password',validate(resetPasswordSchema),asyncHandler(authController.resetPassword));
router.post('/change-password',authenticate,validate(changePasswordSchema),asyncHandler(authController.changePassword));
router.get('/me',authenticate,asyncHandler(authController.me));
router.post('/accept-invitation',validate(invitationSchema),asyncHandler(authController.acceptInvitation));
export default router;
