import express from 'express';
import { prisma } from '../lib/utils/prisma/index.js';
import userAuthMiddleware from '../middlewares/auths/user-auth.middleware.js';

const router = express.Router();

router.use(userAuthMiddleware);
router.use('/transfer', router);

// 중요 데이터 및 자주쓰는 표현
class transferData {
  constructor() {
    // 수수료 비율 (15%)
    this.charge = 0.15;

    // 이적시장 카드 최소 가격
    this.minprice = 100;

    // 자주쓰는 표현
    this.INVENTORY = 'inventory';
    this.TRANSFER = 'transfer';
  }
}
const transferdata = new transferData();

// 이적시장 판매 등록
router.post('/sell', async (req, res, next) => {
  try {
    const { cardId, price } = req.body;

    // club 존재 여부
    const club = await prisma.club.findFirst({
      where: { userId: req.user.userId },
    });
    if (!club) {
      return res.status(404).json({ Message: '클럽을 먼저 생성해 주세요.' });
    }

    // 가격 유효성 검사
    if (isNaN(price) || price < transferdata.minprice) {
      return res.status(400).json({
        Message: `올바른 형식의 가격을 입력하세요. (${transferdata.minprice} 이상의 숫자를 입력해주세요)`,
      });
    }

    // 카드아이디 유효성 검사
    if (isNaN(cardId)) {
      return res
        .status(400)
        .json({ Message: '올바른 형식의 카드아이디를 입력하세요. (숫자를 입력해주세요)' });
    }
    const card = await prisma.cards.findFirst({
      where: { cardId: cardId },
    });
    if (!card) {
      return res.status(404).json({ Message: '존재하지 않는 카드 아이디입니다.' });
    }

    // 카드 소유권 검사
    if (card.userId !== req.user.userId) {
      return res.status(403).json({ Message: '다른 유저의 카드를 등록할 수 없습니다.' });
    }

    // inventory에 있는게 맞는지
    if (card.state !== transferdata.INVENTORY) {
      return res.status(400).json({ Message: '등록하고 싶은 카드는 인벤토리에 있어야합니다.' });
    }

    // 이적시장에 카드 등록
    const transfercard = await prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.create({
        data: {
          cardId: cardId,
          price: price,
        },
      });

      await tx.cards.update({
        where: { cardId: cardId },
        data: { state: transferdata.TRANSFER },
      });

      return transfer;
    });
    const registeredcard = { ...transfercard, ...card };

    return res.status(201).json({
      Message: `이적시장에 ${card.card_enhancement}강 ${card.cardName}카드가 등록되었습니다!`,
      registeredcard,
    });
  } catch (error) {
    next(error);
  }
});

// 이적시장 구매
router.patch('/purchase', async (req, res, next) => {
  try {
    const { transferId } = req.body;

    // club 존재 여부
    const club = await prisma.club.findFirst({
      where: { userId: req.user.userId },
    });
    if (!club) {
      return res.status(404).json({ Message: '클럽을 먼저 생성해 주세요.' });
    }

    // 이적시장 고유 아이디의 유효성
    if (isNaN(transferId)) {
      return res.status(400).json({ Message: '이적시장 아이디는 숫자를 입력해주세요.' });
    }
    const transfer = await prisma.transfer.findFirst({
      where: { transferId: transferId },
    });
    if (!transfer) {
      return res.status(404).json({ Message: '존재하지 않는 이적시장 아이디입니다.' });
    }

    // 자신이 등록한 카드를 구매하려할 경우
    const card = await prisma.cards.findFirst({
      where: { cardId: transfer.cardId },
    });
    if (club.clubId === card.clubId) {
      return res.status(400).json({ Message: '자신이 등록한 카드를 구매할 수 없습니다.' });
    }

    // 돈이 충분히 준비되어 있는지 여부
    if (club.gold < transfer.price) {
      return res.status(404).json({ Message: `돈이 ${transfer.price - club.gold}원 부족합니다.` });
    }

    const sellclub = await prisma.club.findFirst({
      where: { userId: card.userId },
    });

    // 다음 카드 번호
    const existingCards = await prisma.cards.findMany({
      where: { userId: club.userId },
      orderBy: { cardNumber: 'desc' },
      take: 1,
    });
    const nextCardNumber = existingCards.length > 0 ? existingCards[0].cardNumber + 1 : 1;

    // 카드 구매
    await prisma.$transaction(async (tx) => {
      await tx.club.update({
        where: { clubId: club.clubId },
        data: {
          gold: club.gold - transfer.price,
        },
      });

      await tx.club.update({
        where: { clubId: sellclub.clubId },
        data: {
          gold: sellclub.gold + Math.floor(transfer.price * (1 - transferdata.charge)),
        },
      });

      await tx.cards.update({
        where: { cardId: transfer.cardId },
        data: {
          userId: req.user.userId,
          clubId: club.clubId,
          cardNumber: nextCardNumber,
          state: transferdata.INVENTORY,
        },
      });

      await tx.transfer.delete({
        where: { transferId: transfer.transferId },
      });
    });

    return res.status(201).json({
      Messaeg: `이적시장에서 ${card.card_enhancement}강 ${card.cardName}카드를 구매하였습니다!`,
      card,
    });
  } catch (error) {
    next(error);
  }
});

// 이적시장 조회
router.get('/search', async (req, res, next) => {
  try {
    const { min, max } = req.body;

    // 클럽 존재 여부 검사
    const club = await prisma.club.findFirst({
      where: { userId: req.user.userId },
    });
    if (!club) {
      return res.status(404).json({ Message: '클럽이 있어야 이적시장을 둘러볼 수 있습니다.' });
    }

    const transferCard = await prisma.transfer.findMany({
      where: {
        price: {
          gte: min,
          lte: max,
        },
      },
      include: {
        cards: {
          select: {
            card_enhancement: true,
            cardCode: true,
            cardName: true,
            speed: true,
            shoot_accuracy: true,
            shoot_power: true,
            defense: true,
            stamina: true,
          },
        },
      },
    });

    return res.status(201).json({ transferCard });
  } catch (error) {
    next(error);
  }
});

// 이적시장 판매 등록 취소
router.delete('/sell', async (req, res, next) => {
  try {
    const { transferId } = req.body;

    // club 존재 여부
    const club = await prisma.club.findFirst({
      where: { userId: req.user.userId },
    });
    if (!club) {
      return res.status(404).json({ Message: '클럽을 먼저 생성해 주세요.' });
    }

    // 이적시장 아이디 유효성 검사
    if (isNaN(transferId)) {
      return res
        .status(400)
        .json({ Message: '올바른 형식의 이적시장 아이디를 입력하세요. (숫자를 입력해주세요)' });
    }
    const transfer = await prisma.transfer.findFirst({
      where: { transferId: transferId },
    });
    if (!transfer) {
      return res.status(400).json({ Message: '존재하지 않는 이적시장 아이디 입니다.' });
    }

    // 카드 소유권 여부 검사
    const card = await prisma.cards.findFirst({
      where: { cardId: transfer.cardId },
    });

    if (card.userId !== req.user.userId) {
      return res.status(403).json({ Message: '다른 유저의 카드를 등록취소할 수 없습니다.' });
    }

    // 이적시장에서 카드 등록 취소
    await prisma.$transaction(async (tx) => {
      await tx.cards.update({
        where: { cardId: transfer.cardId },
        data: { state: transferdata.INVENTORY },
      });

      await tx.transfer.delete({
        where: { transferId: transferId },
      });
    });
    const registeredcard = { ...transfer, ...card };

    return res.status(200).json({
      Message: `이적시장에서 ${card.card_enhancement}강 ${card.cardName}카드의 등록이 취소되었습니다.`,
      registeredcard,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
