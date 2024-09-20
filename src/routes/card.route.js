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
        cardName: true,
        speed: true,
        shoot_accuracy: true,
        shoot_power: true,
        defense: true,
        stamina: true,
      }
    })

    return res.status(200).json({ data : cards })
  } catch (error) {
    next(error);
  }