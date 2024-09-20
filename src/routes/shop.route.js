import express from 'express';
import { prisma } from '../lib/utils/prisma/index.js';
import au from '../middlewares/auths/user-auth.middleware.js';
const router = express.Router();
// 선수카드 가격 (골드)
const goldprice = 1000;
// 감독카드 가격 (캐시)
const cashprice = 1000;
// 캐시 충전량 제한 (최소)
const mincash = 1000;
// 캐시 충전량 제한 (최대)
const maxcash = 100000;
// 카드 랜덤 뽑기
router.post('/shop/gacha', au, async (req, res, next) => {
  try {
    const { type, count } = req.body;
    const club = await prisma.club.findFirst({
      where: { userId: req.user.userId },
    });
    // 유효성 검사
    if (type !== 'player' && type !== 'manager') {
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
    const cards = [];
    // 카드 생성 및 골드/캐시 차감
    await prisma.$transaction(async (tx) => {
      // 카드 번호 설정
      const existingCards = await tx.cards.findMany({
        where: { userId: club.userId },
        orderBy: { cardNumber: 'desc' },
        take: 1,
      });
      const nextCardNumber = existingCards.length > 0 ? existingCards[0].cardNumber + 1 : 1;
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
            cardNumber: nextCardNumber + i, // 각 카드에 대한 번호 설정
            type: type
          },
        });
        cards.push(card);
      }
      // 골드 또는 캐시 차감
      await tx.club.update({
        where: { clubId: club.clubId },
        data: {
          [type === 'player' ? 'gold' : 'cash']: {
            decrement: type === 'player' ? goldprice * count : cashprice * count,
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
router.patch('/shop/recharge', au, async (req, res, next) => {
  try {
    const { cash } = req.body;
    // 유효성 검사
    if (isNaN(cash)) {
      return res.status(400).json({ message: '캐시는 숫자를 입력해주세요.' });
    }
    // 캐시 충전 범위
    if (cash <= mincash || cash >= maxcash) {
      return res
        .status(400)
        .json({ message: '캐시는 한번에 최소 1000원 최대 100만원까지 충전이 가능합니다.' });
    }
    // 충전
    const club = await prisma.club.findFirst({
      where: { userId: req.user.userId },
    });
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