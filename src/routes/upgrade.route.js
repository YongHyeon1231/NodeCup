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
router.post('/upgrading', au, async (req, res, next) => {
  try {
    const { cardId } = req.body;

    // 유효성 검사
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

    // 카드 장착 여부 검사
    if (upgradecard.equipState === "formaiton") {
      return res.status(400).json({
        Message: '포메이션에 장착중인 카드는 강화할 수 없습니다. 장착을 해제하고 시도해주세요',
      });
    }

    // 카드 소유권 검사
    if (upgradecard.userId !== req.user.userId) {
      return res.status(403).json({ Message: '다른 유저의 카드를 강화할 수 없슨니다.' });
    }

    // 재료 카드 존재 여부 검사
    const materialcard = await prisma.cards.findFirst({
      where: {
        cardCode: upgradecard.cardCode,
        card_enhancement: upgradecard.card_enhancement,
        NOT: { cardId: cardId },
      },
    });
    if (!materialcard) {
      return res.status(404).json({
        Message: '재료카드가 존재하지 않습니다. (강화 레벨과 카드종류가 동일한 카드가 필요합니다)',
      });
    }

    // 강화 성공/실패
    const percentage =
      upgrade_percentage_zero - upgradecard.card_enhancement * upgrade_percentage_down;
    const cardmodel = await prisma.cardModel.findFirst({
      where: { cardCode: upgradecard.cardCode },
    });
    if (Math.random() < percentage) {
      const upgradedcard = await prisma.$transaction(async (tx) => {
        const card = await tx.cards.update({
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

        await tx.cards.delete({
          where: { cardId: materialcard.cardId },
        });

        return card;
      });

      return res.status(201).json({
        Message: '강화에 성공하여 재료카드가 소진되었습니다',
        upgradedcard,
        materialcard,
      });
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.cards.delete({
          where: { cardId: materialcard.cardId },
        });
      });

      return res.status(201).json({ Message: '강화에 실패하였습니다.' });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
