import express from 'express';
import { prisma } from '../lib/utils/prisma/index.js';
import userAuthMiddleware from '../middlewares/auths/user-auth.middleware.js';

const router = express.Router();

router.use(userAuthMiddleware);
router.use('/shop', router);

// 중요 데이터 및 자주쓰는 표현
class shopData {
  constructor() {
    // 선수 카드 뽑기 가격 (골드)
    this.goldPrice = 1000;

    // 감독 카드 뽑기 가격 (캐시)
    this.cashPrice = 1000;

    // 한번에 최소 캐시 충전량 제한
    this.minCash = 1000;

    // 한번에 최대 캐시 충전량 제한
    this.maxCash = 1000000;

    // 자주쓰는 표현
    this.MANAGER = 'manager';
    this.PLAYER = 'player';
  }
}
const shop = new shopData();

// 카드 랜덤 뽑기
router.post('/gacha', async (req, res, next) => {
  try {
    const { type, count } = req.body;

    const club = await prisma.club.findFirst({
      where: { userId: req.user.userId },
    });

    // 유효성 검사
    if (!club) {
      return res.status(404).json({ Message: '클럽을 먼저 생성해 주세요.' });
    }

    if (type !== shop.MANAGER && type !== shop.PLAYER) {
      return res.status(400).json({ message: '올바른 카드타입(player, manager)을 입력하세요.' });
    }

    if (isNaN(count) || count <= 0) {
      return res.status(400).json({ message: '개수(count)는 1 이상의 숫자를 입력하세요.' });
    }

    // 준비된 카드 모델 존재 여부 검사
    const allCards = await prisma.cardModel.findMany({
      where: { type },
    });
    if (allCards.length === 0) {
      return res.status(503).json({ message: `아직 ${type} 카드 모델을 준비중입니다.` });
    }

    // 재화 부족 여부 검사
    if (type === shop.PLAYER && shop.goldPrice * count > club.gold) {
      return res
        .status(400)
        .json({ message: `골드가 ${shop.goldPrice * count - club.gold}원만큼 부족합니다.` });
    }

    if (type === shop.MANAGER && shop.cashPrice * count > club.cash) {
      return res
        .status(400)
        .json({ message: `캐시가 ${shop.cashPrice * count - club.cash}원만큼 부족합니다.` });
    }

    // 카드 번호 설정
    const existingCards = await prisma.cards.findMany({
      where: { userId: club.userId },
      orderBy: { cardNumber: 'desc' },
      take: 1,
    });
    const nextCardNumber = existingCards.length > 0 ? existingCards[0].cardNumber + 1 : 1;

    const cards = [];

    // 카드 생성 및 골드/캐시 차감
    await prisma.$transaction(async (tx) => {
      // 카드 생성
      for (let i = 0; i < count; i++) {
        const randomN = Math.floor(Math.random() * allCards.length);
        const selectedCard = allCards[randomN];
        const card = await tx.cards.create({
          data: {
            clubId: club.clubId,
            userId: club.userId,
            cardCode: selectedCard.cardCode,
            cardName: selectedCard.cardName,
            speed: selectedCard.speed,
            shoot_accuracy: selectedCard.shoot_accuracy,
            shoot_power: selectedCard.shoot_power,
            defense: selectedCard.defense,
            stamina: selectedCard.stamina,
            cardNumber: nextCardNumber + i,
            type: type,
          },
        });
        cards.push(card);
      }
      // 골드 또는 캐시 차감
      await tx.club.update({
        where: { clubId: club.clubId },
        data: {
          [type === shop.MANAGER ? 'gold' : 'cash']: {
            decrement: type === shop.PLAYER ? shop.goldPrice * count : shop.cashPrice * count,
          },
        },
      });
    });
    return res.status(201).json({ cards });
  } catch (error) {
    next(error);
  }
});

// 캐시 충전
router.patch('/recharge', async (req, res, next) => {
  try {
    const { cash } = req.body;

    const club = await prisma.club.findFirst({
      where: { userId: req.user.userId },
    });

    // 유효성 검사
    if (!club) {
      return res.status(404).json({ Message: '클럽을 먼저 생성해 주세요.' });
    }

    if (isNaN(cash)) {
      return res.status(400).json({ message: '캐시는 숫자를 입력해주세요.' });
    }

    // 캐시 충전 범위
    if (cash < shop.minCash || cash > shop.maxCash) {
      return res.status(400).json({
        message: `캐시는 한번에 최소 ${shop.minCash}원 최대 ${shop.maxCash / 10000}만원까지 충전이 가능합니다.`,
      });
    }

    // 충전
    await prisma.club.update({
      where: { clubId: club.clubId },
      data: {
        cash: club.cash + cash,
      },
    });
    return res.status(201).json({ message: '캐시 충전이 완료되었습니다!' });
  } catch (error) {
    next(error);
  }
});

export default router;
