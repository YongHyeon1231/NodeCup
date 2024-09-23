import { prisma } from '../lib/utils/prisma/index.js';
import express from 'express';
import userAuthMiddleware from '../middlewares/auths/user-auth.middleware.js';
import fv from '../middlewares/validators/formationsValidator.middleware.js';
import cardRepository from '../repositories/cardRepository.js';
import formationRepository from '../repositories/formationRepository.js';

const MANAGER = 'manager';
const TRANSFER = 'transfer';
const FORMATION = 'formation';
const INVENTORY = 'inventory';
const LINEUP = { A: 'A', B: 'B' };

// 팀 스텟 값 계산 함수
const addTotalStat = (origin, card) => {
  origin =
    origin +
    (card.speed * 0.1 +
      card.shootAccuracy * 0.25 +
      card.shootPower * 0.15 +
      card.defense * 0.3 +
      card.stamina * 0.2);
  return Math.floor(origin);
};

const subTotalStat = (origin, card) => {
  origin =
    origin -
    (card.speed * 0.1 +
      card.shootAccuracy * 0.25 +
      card.shootPower * 0.15 +
      card.defense * 0.3 +
      card.stamina * 0.2);
  return Math.floor(origin);
};

const pathRouter = express.Router();
const router = express.Router();
pathRouter.use('/formations', userAuthMiddleware, router);

router.post('/equip', fv.equipCodeBodyValidation, async (req, res, next) => {
  try {
    const { cardNumber, lineUp, position } = req.body;
    const userId = req.user.userId;
    const userClub = await cardRepository.findUserClub(userId);

    if (!userClub) {
      return res.status(404).json({ message: '클럽이 존재하지 않습니다.' });
    }

    const inputCard = await cardRepository.findCardByCardNumber(
      cardNumber,
      userId,
      userClub.clubId,
    );

    if (!inputCard) {
      return res
        .status(404)
        .json({ message: `해당 슬롯:${cardNumber}에 해당하는 카드가 슬롯에 없습니다.` });
    }

    if (position !== MANAGER && inputCard === MANAGER) {
      return res.status(401).json({
        message: '플레이어 포지션은 플레이어 카드만 넣을 수 있습니다.',
        data: `넣으려고 한 카드 : ${inputCard}`,
      });
    }

    if (position === MANAGER && inputCard.type !== MANAGER) {
      return res.status(401).json({
        message: '감독 포지션은 감독 카드만 넣을 수 있습니다.',
        data: `넣으려고 한 카드 : ${inputCard}`,
      });
    }

    if (inputCard.state === TRANSFER) {
      return res.status(401).json({ message: '해당 카드는 이적 시장에 올라와져 있습니다.' });
    }

    if (inputCard.state === FORMATION) {
      return res.status(401).json({ message: '해당 카드는 다른 Position에 장착되어 있습니다.' });
    }

    const prevFormationCard = await formationRepository.findFormation(
      userId,
      userClub.clubId,
      lineUp,
      position,
    );

    let updatedTeamTotalStat = prevFormationCard
      ? addTotalStat(prevFormationCard.teamTotalStat, inputCard)
      : addTotalStat(0, inputCard);

    console.log('테스트입니다.', updatedTeamTotalStat, prevFormationCard);

    if (prevFormationCard) {
      const alreadyEquipCard = await cardRepository.findCardByCardNumber(
        prevFormationCard.cardNumber,
        userId,
        userClub.clubId,
      );
      if (!alreadyEquipCard) {
        return res.status(401).json({ message: '장착되어 있는 카드 슬롯을 찾지 못했습니다.' });
      }

      await prisma.$transaction(async (tx) => {
        const unequipCard = await tx.card.update({
          where: {
            cardId: alreadyEquipCard.cardId,
            userId: userId,
            clubId: userClub.clubId,
            cardNumber: prevFormationCard.cardNumber,
          },
          data: {
            state: INVENTORY,
          },
        });

        updatedTeamTotalStat = subTotalStat(updatedTeamTotalStat, unequipCard);

        await tx.card.update({
          where: {
            cardId: inputCard.cardId,
            userId: userId,
            clubId: userClub.clubId,
            cardNumber: inputCard.cardNumber,
          },
          data: {
            state: FORMATION,
          },
        });

        await tx.formations.update({
          where: {
            formationId: prevFormationCard.formationId,
            userId: userId,
            clubId: userClub.clubId,
            lineUp: lineUp,
            position: position,
          },
          data: {
            cardEnhancement: inputCard.cardEnhancement,
            cardName: inputCard.cardName,
            cardNumber: inputCard.cardNumber,
            teamTotalStat: +updatedTeamTotalStat,
            lineUp: lineUp,
            position: position,
          },
        });

        await tx.formations.updateMany({
          where: {
            userId: userId,
            clubId: userClub.clubId,
            lineUp: lineUp,
          },
          data: {
            teamTotalStat: +updatedTeamTotalStat,
          },
        });
      });
      return res.status(200).json({ message: '포메이션 카드가 바뀌었습니다.' });
    } else {
      const teamFormationCard = await formationRepository.findAnyFormation(
        userId,
        userClub.clubId,
        lineUp,
      );

      if (teamFormationCard) {
        updatedTeamTotalStat += teamFormationCard.teamTotalStat;
      }

      await prisma.$transaction(async (tx) => {
        await tx.formations.create({
          data: {
            userId: userId,
            // clubId: userClub.clubId,
            cardEnhancement: inputCard.cardEnhancement,
            cardName: inputCard.cardName,
            cardNumber: inputCard.cardNumber,
            teamTotalStat: +updatedTeamTotalStat,
            lineUp: lineUp,
            position: position,
            club: {
              connect: {
                clubId: userClub.clubId,
              },
            },
          },
        });

        await tx.card.update({
          where: {
            userId: userId,
            cardId: inputCard.cardId,
            clubId: userClub.clubId,
            cardNumber: cardNumber,
          },
          data: {
            state: FORMATION,
          },
        });

        await tx.formations.updateMany({
          where: {
            userId: userId,
            clubId: userClub.clubId,
            lineUp: lineUp,
          },
          data: {
            teamTotalStat: +updatedTeamTotalStat,
          },
        });
      });
      return res
        .status(200)
        .json({ message: '포메이션이 추가되었습니다.', data: createFormationCard });
    }
    return res
      .status(400)
      .json({ mesage: '포메이션 카드 장착이 정상적으로 이루어지지 않았습니다.' });
  } catch (error) {
    next(error);
  }
});

router.post('/unequip', fv.unequipCodeBodyValidation, async (req, res, next) => {});

export default pathRouter;
