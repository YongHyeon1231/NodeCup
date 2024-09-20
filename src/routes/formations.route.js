import express from 'express';
import { prisma } from '../lib/utils/prisma/index.js';
import au from '../middlewares/auths/user-auth.middleware.js';
import fv from '../middlewares/validators/formationsValidator.middleware.js';

const router = express.Router();

// 포메이션 팀 카드 넣기 validator만들기 생각
router.post('/formations/equip', au, fv.equipCodeBodyValidation , async (req, res, next) => {
  try {
    const { cardNumber, lineUp, position } = req.body;
    const userId = req.user.userId;

    // 클럽 정보 조회 <- 나중에 auths로 바꿔보자
    const userClub = await prisma.club.findFirst({ where: { userId: userId } });

    if (!userClub) {
      return res.status(404).json({ message: '클럽이 존재하지 않습니다.' });
    }

    // 포메이션 슬롯에 넣을 카드 찾기
    const inputCard = await prisma.cards.findFirst({
      where: { cardNumber: cardNumber, userId: userId, clubId: userClub.clubId },
    });

    if (!inputCard) {
      return res
        .status(404)
        .json({ message: `해당 슬롯:${cardNumber}에 해당하는 카드가 슬롯에 없습니다.` });
    }

    // 이적 시장에 있는 카드가 아니라면
    if (inputCard.state === 'transfer') {
      return res.status(401).json({ message: '해당 카드는 이적 시장에 올라와져 있습니다.' });
    }

    // 현재 상태 : cards가 인벤토리에 있거나 이미 장착된 카드

    // 장착되어 있는 카드 포메이션 찾기
    const preformationCard = await prisma.formations.findFirst({
      where: {
        lineUp: lineUp,
        position: position,
        userId: userId,
        clubId: userClub.clubId,
      },
    });

    let updatedTeamTotalStat = 0;
    if (preformationCard) {
      updatedTeamTotalStat = AddCal(preformationCard.teamTotalStat, inputCard);
    } else if (!preformationCard) {
      updatedTeamTotalStat = AddCal(updatedTeamTotalStat, inputCard);
    }

    let msg;

    await prisma.$transaction(async (tx) => {
      if (preformationCard) {
        // 장착되어 있는 카드 슬롯 찾기
        const alreadyEquipCard = await tx.cards.findFirst({
          where: {
            userId: userId,
            clubId: userClub.clubId,
            cardNumber: preformationCard.cardNumber,
          },
        });

        if (!alreadyEquipCard) {
          return res.status(401).json({ message: '장착되어 있는 카드 슬롯을 찾지 못했습니다.' });
        }
        console.log('test => ', preformationCard.cardNumber, alreadyEquipCard.cardId);
        // 장착 카드 state update
        const unequipCard = await tx.cards.update({
          where: {
            cardNumber: preformationCard.cardNumber,
            cardId: alreadyEquipCard.cardId,
            userId: userId,
            clubId: userClub.clubId,
          },
          data: {
            state: 'inventory',
          },
        });

        updatedTeamTotalStat = SubCal(updatedTeamTotalStat, unequipCard);

        // 장착 할 카드 state update
        await tx.cards.update({
          where: {
            userId: userId,
            clubId: userClub.clubId,
            cardNumber: inputCard.cardNumber,
            cardId: inputCard.cardId
          },
          data: {
            state: 'formation'
          }
        })

        // 포메이션 슬롯 update
        const updateFormationCard = await tx.formations.update({
          where: {
            formationId: preformationCard.formationId,
            userId: userId,
            clubId: userClub.clubId,
            lineUp: lineUp,
            position: position,
          },
          data: {
            card_enhancement: inputCard.card_enhancement,
            cardName: inputCard.cardName,
            cardNumber: inputCard.cardNumber,
            teamTotalStat: updatedTeamTotalStat,
            lineUp: lineUp,
            position: position,
          },
        });

        // 포메이션 슬롯에 장착되어 있는 teamtotalStat 전체 바꾸기
        await tx.formations.updateMany({
          where: {
            userId: userId,
            clubId: userClub.clubId,
            lineUp: lineUp,
          },
          data: {
            teamTotalStat: updatedTeamTotalStat,
          },
        });
        msg = { message: '포메이션 카드가 바뀌었습니다.', data: updateFormationCard };
      } else {
        // 같은 linUp에 장착되어 있는 포메이션 카드 찾기
        const teamFormationCard = await tx.formations.findFirst({
          where: {
            lineUp: lineUp,
            userId: userId,
            clubId: userClub.clubId,
          },
        });

        if (teamFormationCard) {
          updatedTeamTotalStat += teamFormationCard.teamTotalStat;
        }

        // 포메이션 슬롯이 비어있기 때문에 생성해주기
        const createFormationCard = await tx.formations.create({
          data: {
            userId: userId,
            clubId: userClub.clubId,
            card_enhancement: inputCard.card_enhancement,
            cardName: inputCard.cardName,
            cardNumber: inputCard.cardNumber,
            teamTotalStat: updatedTeamTotalStat, //이전 카드 Teamtotal Stat 에다가 +(inputCard.speed* 0.1) + (inputCard.shoot_accuracy*0.25) + (inputCard.shoot_power*0.15)+ (inputCard.defense*0.3) + (inputCard.stamina*0.2) 더하기
            lineUp: lineUp,
            position: position,
          },
        });

        await tx.cards.update({
          // 해당 슬롯 equipState true로 바꿔주기
          where: {
            cardNumber: cardNumber,
            userId: userId,
            cardId: inputCard.cardId,
            clubId: userClub.clubId,
          },
          data: {
            state: 'formation',
          },
        });

        // teamtotalStat 전체 바꾸기
        await tx.formations.updateMany({
          where: {
            userId: userId,
            clubId: userClub.clubId,
            lineUp: lineUp,
          },
          data: {
            teamTotalStat: updatedTeamTotalStat,
          },
        });
        msg = { message: '포메이션이 추가되었습니다.', data: createFormationCard };
      }
    });

    return res.status(200).json(msg);
  } catch (error) {
    next(error);
  }
});

// 포메이션 카드 unequip
router.post('/formations/unequip', au, fv.unequipCodeBodyValidation, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { cardNumber, lineUp, position } = req.body;
    const userClub = await prisma.club.findFirst({ where: { userId: req.user.userId } });

    // 카드 슬롯에 카드가 있는지 확인
    const inputCard = await prisma.cards.findFirst({
      where: { cardNumber: cardNumber, userId: userId, clubId: userClub.clubId },
    });

    if (!inputCard) {
      return res
        .status(404)
        .json({ message: `해당 슬롯:${cardNumber}에 해당하는 카드가 슬롯에 없습니다.` });
    }

    // 장착 되어 있지 않은 카드라면
    console.log("inpuCard.state => ", inputCard.state)
    if (inputCard.state !== 'formation') {
      return res.status(401).json({ message: 'inputCard => 장착된 카드가 아닙니다.' });
    }

    // 해당 포메이션 슬롯에 해당 lineUp과 Position에 카드가 있는지 체크
    const preformationCard = await prisma.formations.findFirst({
      where: {
        lineUp: lineUp,
        position: position,
        userId: userId,
        clubId: userClub.clubId,
      },
    });

    if (!preformationCard) {
      return res
        .status(401)
        .json({ message: 'preformationCard => 해당 카드는 장착이 되어있지 않습니다.' });
    }

    await prisma.$transaction(async (tx) => {
      // 장착 해제
      const unequipCard = await tx.cards.update({
        where: {
          slotNumber: inputCard.slotNumber,
          cardId: inputCard.cardId,
          userId: userId,
        },
        data: {
          state: 'inventory',
        },
      });

      // 해당 슬롯 데이터 비워두기
      await tx.formations.delete({
        where: {
          formationId: preformationCard.formationId,
          lineUp: lineUp,
          position: position,
          userId: userId,
          clubId: userClub.clubId,
        },
      });

      const updatedTeamTotalStat = SubCal(preformationCard.teamTotalStat, unequipCard);

      // teamtotalStat 전체 바꾸기
      await tx.formations.updateMany({
        where: {
          userId: userId,
          clubId: userClub.clubId,
          lineUp: lineUp,
        },
        data: {
          teamTotalStat: updatedTeamTotalStat,
        },
      });

      return res.status(201).json({
        changedTeamTotalStat: updatedTeamTotalStat,
        message: '해당 카드가 장착 해제 되었습니다.',
        data: unequipCard,
      });
    });
  } catch (error) {
    next(error);
  }
});

const AddCal = (origin, card) => {
  origin =
    origin +
    card.speed * 0.1 +
    card.shoot_accuracy * 0.25 +
    card.shoot_power * 0.15 +
    card.defense * 0.3 +
    card.stamina * 0.2;
  return origin;
};

const SubCal = (origin, card) => {
  origin =
    origin -
    (card.speed * 0.1 +
      card.shoot_accuracy * 0.25 +
      card.shoot_power * 0.15 +
      card.defense * 0.3 +
      card.stamina * 0.2);
  return origin;
};

// 포메이션 조회 가능
// 질문 -> formations가 여러개인데 lineUp이 2개인데 lineUp으로 구분지어서 조회
router.get('/formations', au, async (req, res, next) => {
  try {
    const formationA = await prisma.formations.findMany({
      where: { userId: req.user.userId, lineUp: 'A' },
      select: {
        cardName: true,
        card_enhancement: true,
        cardNumber: true,
        position: true,
        teamTotalStat: true,
      },
    });

    const formationB = await prisma.formations.findMany({
      where: { userId: req.user.userId, lineUp: 'B' },
      select: {
        cardName: true,
        card_enhancement: true,
        cardNumber: true,
        position: true,
        teamTotalStat: true,
      },
    });

    const msg = { LineUp_A: formationA, LineUp_B: formationB };
    return res.status(200).json(msg);
  } catch (error) {
    next(error);
  }
});

export default router;
