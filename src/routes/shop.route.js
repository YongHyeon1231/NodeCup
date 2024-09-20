import express from 'express';
import { prisma } from '../lib/utils/prisma/index.js';
import au from '../middlewares/auths/user-auth.middleware.js';

const router = express.Router();

// 선수카드 가격 (골드)
const goldprice = 1000;

// 감독카드 가격 (캐시)
const cashprice = 1000;

// 캐치 한번에 충전량 제한 (최소)
const mincash = 1000;

// 캐치 한번에 충전량 제한 (최대)
const maxcash = 100000;

// 카드 랜덤 뽑기
router.post('/shop/gacha', au, async (req, res, next) => {
  try {
    const { type, count } = req.body;

    const club = await prisma.club.findFirst({
      where: { userId: req.user.userId },
    });

    // 유효성 검사
    // 카드 아이디 타입 검사
    if (type !== 'player' && type !== 'manager') {
      return res.status(400).json({ Message: '올바른 카드타입(player,manager)을 입력하세요.' });
    }

    // count 타입 검사
    if (isNaN(count)) {
      return res.status(400).json({ Message: '개수(count)는 숫자를 입력하세요.' });
    }

    // 준비된 카드 모델 존재 여부 검사
    const countplayer = await prisma.cardModel.count({
      where: { type: 'player' },
    });
    if (countplayer === 0 && type === 'player') {
      return res.status(503).json({ Message: '아직 선수카드 모델을 준비중입니다.' });
    }
    const countmanager = await prisma.cardModel.count({
      where: { type: 'manager' },
    });
    if (countmanager === 0 && type === 'manager') {
      return res.status(503).json({ Message: '아직 감독카드 모델을 준비중입니다.' });
    }

    const cards = [];
    // 선수 카드 구매 요청 시
    if (type === 'player') {
      if (club.gold < goldprice * count) {
        return res.status(402).json({ Message: '골드가 부족합니다.' });
      }
      const allplayercard = await prisma.cardModel.findMany({
        where: { type: 'player' },
      });

      // 선수 카드 생성 및 골드 차감
      await prisma.$transaction(
        async (tx) => {
          for (let i = 0; i < count; i++) {
            const randomN = Math.floor(Math.random() * countplayer);

            const selectedplayercard = allplayercard[randomN];

            const card = await tx.cards.create({
              data: {
                clubId: club.clubId,
                userId: club.userId,
                cardCode: selectedplayercard.cardCode,
                cardName: selectedplayercard.cardName,
                speed: selectedplayercard.speed,
                shoot_accuracy: selectedplayercard.shoot_accuracy,
                shoot_power: selectedplayercard.shoot_power,
                defense: selectedplayercard.defense,
                stamina: selectedplayercard.stamina,
                cardNumber: 0,
              },
            });

            cards.push(card);
          }

          await tx.club.update({
            where: { clubId: club.clubId },
            data: {
              gold: club.gold - goldprice * count,
            },
          });
        },
        { isolationLevel: 'READ COMMITTED' },
      );
    }

    // 감독카드 구매 요청 시
    if (type === 'manager') {
      if (club.cash < cashprice * count) {
        return res.status(402).json({ Message: '캐시가 부족합니다.' });
      }
      const allmanagercard = await prisma.cardModel.findMany({
        where: { type: 'manager' },
      });

      // 감독 카드 생성 및 캐쉬 차감
      await prisma.$transaction(
        async (tx) => {
          for (let i = 0; i < count; i++) {
            const randomN = Math.floor(Math.random() * countmanager);

            const selectedmanagercard = allmanagercard[randomN];

            const card = await tx.cards.create({
              data: {
                clubId: club.clubId,
                userId: club.userId,
                cardCode: selectedmanagercard.cardCode,
                cardName: selectedmanagercard.cardName,
                speed: selectedmanagercard.speed,
                shoot_accuracy: selectedmanagercard.shoot_accuracy,
                shoot_power: selectedmanagercard.shoot_power,
                defense: selectedmanagercard.defense,
                stamina: selectedmanagercard.stamina,
                cardNumber: 0,
              },
            });

            cards.push(card);
          }

          await tx.club.update({
            where: { clubId: club.clubId },
            data: {
              cash: club.cash - cashprice * count,
            },
          });
        },
        { isolationLevel: 'READ COMMITTED' },
      );
    }

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
      return res.status(400).json({ Message: '캐시는 숫자를 입력해주세요.' });
    }

    // 캐시 충전 범위
    if (cash <= mincash || cash >= maxcash) {
      return res
        .status(400)
        .json({ Message: '캐시는 한번에 최소1000원 최대100만원까지 충전이 가능합니다.' });
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

    return res.status(201).json({ Messag: '캐시충전이 완료되었습니다!' });
  } catch (error) {
    next(error);
  }
});

export default router;
