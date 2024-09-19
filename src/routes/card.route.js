import express from 'express';
import { prisma } from '../lib/utils/prisma/index.js';
import au from '../middlewares/auths/user-auth.middleware.js';
const router = express.Router();
// 가지고 있는 카드 전체 목록 조회 API
router.get('/cards', au, async (req, res, next) => {
  try {
    const cards = await prisma.cards.findMany({
      where: { userId: req.user.userId },
      select: {
        card_enhancement: true,
        cardNumber: true,
        cardCode: true
      }
    });

    const msg = [];
    for (let i = 0; i < cards.length; i++) {
      const card = await prisma.cardModel.findFirst({
        where: { cardCode: cards[i].cardCode },
      });

      const mergedObj = {...card, ...cards[i]}

      msg.push(mergedObj);
    }

    return res.status(200).json({msg});
  } catch (error) {
    next(error);
  }
});
export default router;
