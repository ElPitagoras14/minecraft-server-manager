import { Router } from 'express';
import { createUser } from './service';

const router = Router();

router.post('/', createUser);

export default router;
