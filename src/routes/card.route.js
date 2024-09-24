import express from 'express';
import { prisma } from '../lib/utils/prisma/index.js';
import au from '../middlewares/auths/user-auth.middleware.js';

const router = express.Router();

// 가지고 있는 카드 전체 목록 조회 API
router.get('/cards', au, async (req, res, next) => {
  try {
    const cards = await prisma.cards.findMany({
      where: {
        userId: req.user.userId,
      },
      select: {
        state: true,
        cardName: true,
        state: true,
        speed: true,
        cardEnhancement: true,
        shootAccuracy: true,
        cardNumber: true,
        shootPower: true,
        defense: true,
        stamina: true,
        type: true,
      },
    });

    return res.status(200).json({ data: cards });
  } catch (error) {
    next(error);
  }
});

export default router;
