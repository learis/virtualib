import { Router } from 'express';
import { getUsers, createUser, getUserById, updateUser, deleteUser, createUserInvitation } from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import * as InvitationController from '../controllers/invitation.controller';
import * as UserController from '../controllers/user.controller';

const router = Router();

// Public routes for email invitations
router.post('/invitations/accept', InvitationController.acceptInvitation);
router.post('/invitations/reject', InvitationController.rejectInvitation);

// Only admin and librarian can manage users
router.use(authenticate, authorize(['admin', 'librarian']));

router.get('/', getUsers);
router.get('/invitations', InvitationController.getInvitations);
router.post('/invitations/:invitation_id/resend', authenticate, authorize(['librarian', 'admin']), InvitationController.resendInvitation);
router.post('/invitations/:invitation_id/cancel', authenticate, authorize(['librarian', 'admin']), InvitationController.cancelInvitation);
router.delete('/invitations/:invitation_id', authenticate, authorize(['librarian', 'admin']), InvitationController.deleteInvitation);

router.post('/users/invite', authenticate, authorize(['librarian', 'admin']), UserController.createUserInvitation);
router.post('/invite', createUserInvitation);
router.post('/', createUser);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
