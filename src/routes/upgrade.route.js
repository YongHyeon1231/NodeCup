import express from 'express';
import { prisma } from '../lib/utils/prisma/index.js';
import au from '../middlewares/auths/user-auth.middleware.js';

const router = express.Router();

// 강화 1단계 상승시 능력치 상승량 (10%)
const upgrade_stat_up = 0.1;

// 강화 0단계 → 1단계 성공 확률 (100%)
const upgrade_percentage_zero = 1;

// 강화 1단계 상승시 강화 성공 확률 하락량 (10%)
const upgrade_percentage_down = 0.1;

// 선수 카드 강화
router.post('/upgrading/one', au, async (req, res, next) => {
  try {
    const { cardId } = req.body;

    // 카드아이디 유효성 검사
    if (isNaN(cardId)) {
      return res
        .status(400)
        .json({ Message: '올바른 형식의 카드아이디를 입력하세요. (숫자를 입력해주세요)' });
    }

    const upgradecard = await prisma.cards.findFirst({
      where: { cardId: cardId },
    });
    if (!upgradecard) {
      return res.status(404).json({ Message: '존재하지 않는 카드아이디 입니다.' });
    }

    // 카드 인벤토리 여부 검사
    if (upgradecard.state !== 'inventory') {
      return res.status(400).json({
        Message: '인벤토리에 있는 카드만 강화가 가능합니다. 장착을 해제하고 시도해주세요',
      });
    }

    // 카드 소유권 검사
    if (upgradecard.userId !== req.user.userId) {
      return res.status(403).json({ Message: '다른 유저의 카드를 강화할 수 없슨니다.' });
    }

    // 재료 카드 존재 여부 검사
    const materialcard = await prisma.cards.findFirst({
      where: {
        userId: req.user.userId,
        cardCode: upgradecard.cardCode,
        card_enhancement: upgradecard.card_enhancement,
        state: 'inventory',
        NOT: { cardId: cardId },
      },
    });
    if (!materialcard) {
      return res.status(404).json({
        Message: '재료카드가 존재하지 않습니다. (강화 레벨과 카드종류가 동일한 카드가 필요합니다)',
      });
    }

    // 강화 성공 확률
    const percentage =
      upgrade_percentage_zero - upgradecard.card_enhancement * upgrade_percentage_down;

    // 능력치 기준 모델
    const cardmodel = await prisma.cardModel.findFirst({
      where: { cardCode: upgradecard.cardCode },
    });

    let result = '';
    let upgradedcard;

    // 강화 시도
    await prisma.$transaction(async (tx) => {
      // 재료카드 소진
      await tx.cards.delete({
        where: { cardId: materialcard.cardId },
      });

      // 강화 성공 시
      if (Math.random() < percentage) {
        upgradedcard = await tx.cards.update({
          where: { cardId: upgradecard.cardId },
          data: {
            card_enhancement: upgradecard.card_enhancement + 1,
            speed: upgradecard.speed + cardmodel.speed * upgrade_stat_up,
            shoot_accuracy: upgradecard.shoot_accuracy + cardmodel.shoot_accuracy * upgrade_stat_up,
            shoot_power: upgradecard.shoot_power + cardmodel.shoot_power * upgrade_stat_up,
            defense: upgradecard.defense + cardmodel.defense * upgrade_stat_up,
            stamina: upgradecard.stamina + cardmodel.stamina * upgrade_stat_up,
          },
        });

        result += '강화에 성공하여 재료카드가 소진되었습니다';
      } else {
        result += '강화에 실패하여 재료카드만 소진되었습니다';
      }
    });

    // cardNumber 정리: 병렬로 처리
    const cardsort = await prisma.cards.findMany({
      where: { userId: req.user.userId },
    });

    const sortpromise = cardsort.map((card, index) => {
      return prisma.cards.update({
        where: { cardId: card.cardId },
        data: { cardNumber: index + 1 },
      });
    });
    await Promise.all(sortpromise);

    return res.status(201).json({ result, upgradedcard, materialcard });
  } catch (error) {
    next(error);
  }
});

// 선수 카드 다중 강화
router.post('/upgrading/every', au, async (req, res, next) => {
  try {
    const { cardId } = req.body;

    // 카드아이디 형식 검사
    if (isNaN(cardId)) {
      return res
        .status(400)
        .json({ Message: '올바른 형식의 카드아이디를 입력하세요. (숫자를 입력해주세요)' });
    }

    // 카드 존재 여부 검사
    const upgradecard = await prisma.cards.findFirst({
      where: { cardId: cardId },
    });
    if (!upgradecard) {
      return res.status(404).json({ Message: '존재하지 않는 카드아이디 입니다.' });
    }

    // 카드 인벤토리 여부 검사
    if (upgradecard.state !== 'inventory') {
      return res.status(400).json({
        Message: '인벤토리에 있는 카드만 강화가 가능합니다. 장착을 해제하고 시도해주세요',
      });
    }

    // 카드 소유권 검사
    if (upgradecard.userId !== req.user.userId) {
      return res.status(403).json({ Message: '다른 유저의 카드를 강화할 수 없슨니다.' });
    }

    // 재료 카드 존재 여부 검사
    const materialcards = await prisma.cards.findMany({
      where: {
        userId: req.user.userId,
        cardCode: upgradecard.cardCode,
        card_enhancement: upgradecard.card_enhancement,
        state: 'inventory',
      },
    });
    if (materialcards.length < 2) {
      return res.status(404).json({
        Message: '재료카드가 존재하지 않습니다. (강화 레벨과 카드종류가 동일한 카드가 필요합니다)',
      });
    }

    // 강화 성공 확률
    const percentage =
      upgrade_percentage_zero - upgradecard.card_enhancement * upgrade_percentage_down;

    // 능력치 기준 모델
    const cardmodel = await prisma.cardModel.findFirst({
      where: { cardCode: upgradecard.cardCode },
    });

    // 강화 시도 예정 횟수
    const tryupgrade = Math.floor(materialcards.length / 2);

    const upgradedcards = []; //res 용도
    const deletedcards = []; //res 용도

    // 강화 시도
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < tryupgrade; i++) {
        // 재료카드 소진
        const deletecards = await tx.cards.delete({
          where: { cardId: materialcards[2 * i + 1].cardId },
        });
        deletedcards.push(deletecards);

        // 강화 성공 시
        if (Math.random() < percentage) {
          const successcard = await tx.cards.update({
            where: { cardId: materialcards[2 * i].cardId },
            data: {
              card_enhancement: materialcards[2 * i].card_enhancement + 1,
              speed: materialcards[2 * i].speed + cardmodel.speed * upgrade_stat_up,
              shoot_accuracy:
                materialcards[2 * i].shoot_accuracy + cardmodel.shoot_accuracy * upgrade_stat_up,
              shoot_power:
                materialcards[2 * i].shoot_power + cardmodel.shoot_power * upgrade_stat_up,
              defense: materialcards[2 * i].defense + cardmodel.defense * upgrade_stat_up,
              stamina: materialcards[2 * i].stamina + cardmodel.stamina * upgrade_stat_up,
            },
          });

          upgradedcards.push(successcard);
        }
      }
    });

    // cardNumber 정리: 병렬로 처리
    const cardsort = await prisma.cards.findMany({
      where: { userId: req.user.userId },
    });

    const sortpromise = cardsort.map((card, index) => {
      return prisma.cards.update({
        where: { cardId: card.cardId },
        data: { cardNumber: index + 1 },
      });
    });
    await Promise.all(sortpromise);

    return res.status(201).json({
      Message: `강화를 ${tryupgrade}회 시도하여 ${upgradedcards.length}회 성공하였습니다`,
      upgradedcards,
      deletedcards,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
