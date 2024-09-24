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
// const addTotalStat = (origin, card) => {
//   origin =
//     origin +
//     (card.speed * 0.1 +
//       card.shootAccuracy * 0.25 +
//       card.shootPower * 0.15 +
//       card.defense * 0.3 +
//       card.stamina * 0.2);
//   return Math.floor(origin);
// };

// const subTotalStat = (origin, card) => {
//   origin =
//     origin -
//     (card.speed * 0.1 +
//       card.shootAccuracy * 0.25 +
//       card.shootPower * 0.15 +
//       card.defense * 0.3 +
//       card.stamina * 0.2);
//   return Math.floor(origin);
// };

const addTotalStat = (origin, position, card) => {
  if (position === 'forward') {
    origin =
      origin +
      (card.speed * 0.3 +
        card.shootAccuracy * 0.25 +
        card.shootPower * 0.3 +
        card.defense * 0.05 +
        card.stamina * 0.1);
  } else if (position === 'midfielder') {
    origin =
      origin +
      (card.speed * 0.2 +
        card.shootAccuracy * 0.2 +
        card.shootPower * 0.25 +
        card.defense * 0.15 +
        card.stamina * 0.2);
  } else if (position === 'defender') {
    origin =
      origin +
      (card.speed * 0.2 +
        card.shootAccuracy * 0.1 +
        card.shootPower * 0.15 +
        card.defense * 0.3 +
        card.stamina * 0.25);
  } else if (position === MANAGER) {
    origin =
      origin +
      (card.speed * 0.2 +
        card.shootAccuracy * 0.2 +
        card.shootPower * 0.2 +
        card.defense * 0.2 +
        card.stamina * 0.2);
  }
  return Math.floor(origin);
};
const subTotalStat = (origin, position, card) => {
  if (position === 'forward') {
    origin =
      origin -
      (card.speed * 0.3 +
        card.shootAccuracy * 0.25 +
        card.shootPower * 0.3 +
        card.defense * 0.05 +
        card.stamina * 0.1);
  } else if (position === 'midfielder') {
    origin =
      origin -
      (card.speed * 0.2 +
        card.shootAccuracy * 0.2 +
        card.shootPower * 0.25 +
        card.defense * 0.15 +
        card.stamina * 0.2);
  } else if (position === 'defender') {
    origin =
      origin -
      (card.speed * 0.2 +
        card.shootAccuracy * 0.1 +
        card.shootPower * 0.15 +
        card.defense * 0.3 +
        card.stamina * 0.25);
  } else if (position === MANAGER) {
    origin =
      origin -
      (card.speed * 0.2 +
        card.shootAccuracy * 0.2 +
        card.shootPower * 0.2 +
        card.defense * 0.2 +
        card.stamina * 0.2);
  }
  return Math.ceil(origin);
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

    if (position !== MANAGER && inputCard.type === MANAGER) {
      return res.status(401).json({
        message: '플레이어 포지션은 플레이어 카드만 넣을 수 있습니다.',
        data: inputCard,
      });
    }

    if (position === MANAGER && inputCard.type !== MANAGER) {
      return res.status(401).json({
        message: '감독 포지션은 감독 카드만 넣을 수 있습니다.',
        data: inputCard,
      });
    }

    if (inputCard.state === TRANSFER) {
      return res.status(401).json({ message: '해당 카드는 이적 시장에 올라와져 있습니다.' });
    }

    if (inputCard.state === FORMATION) {
      return res.status(401).json({ message: '해당 카드는 다른 Position에 장착되어 있습니다.' });
    }

    // 동일한 cardCode 검출
    const teamFormations = await formationRepository.findManyFormationNotPosition(userId, userClub.clubId, lineUp, position)
    for (const team of teamFormations) {
      const card = await cardRepository.findCardByCardNumber(team.cardNumber, userId, userClub.clubId);
      if (card.cardCode === inputCard.cardCode) {
        return res.status(401).json({message: '이미 포함되어 있는 선수를 장착할 수 없습니다.'});
      }
    }

    const prevFormationCard = await formationRepository.findFormation(
      userId,
      userClub.clubId,
      lineUp,
      position,
    );

    let updatedTeamTotalStat = prevFormationCard
      ? addTotalStat(prevFormationCard.teamTotalStat, position, inputCard)
      : addTotalStat(0, position, inputCard);

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

        updatedTeamTotalStat = subTotalStat(updatedTeamTotalStat, position, unequipCard);

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
        .json({ message: '포메이션이 추가되었습니다.'});
    }
    return res
      .status(400)
      .json({ mesage: '포메이션 카드 장착이 정상적으로 이루어지지 않았습니다.' });
  } catch (error) {
    next(error);
  }
});

router.post('/unequip', fv.unequipCodeBodyValidation, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { cardNumber, lineUp, position } = req.body;
    const userClub = await cardRepository.findUserClub(userId);

    const inputCard = await cardRepository.findCardByCardNumber(
      cardNumber,
      userId,
      userClub.clubId,
    );

    // 카드 슬롯에 카드가 있는지 확인
    if (!inputCard) {
      return res
        .status(404)
        .json({ message: `해당 슬롯:${cardNumber}에 해당하는 카드가 슬롯에 없습니다.` });
    }

    // 장착 되어 있지 않은 카드라면
    console.log('inpuCard.state => ', inputCard.state);
    if (inputCard.state !== FORMATION) {
      return res.status(401).json({ message: 'inputCard => 장착된 카드가 아닙니다.' });
    }

    // 해당 포메이션 슬롯에 해당 lineUp과 Position에 카드가 있는지 체크
    const prevformationCard = await formationRepository.findFormation(
      userId,
      userClub.clubId,
      lineUp,
      position,
    );

    if (!prevformationCard) {
      return res
        .status(401)
        .json({ message: 'prevformationCard => 해당 카드는 장착이 되어있지 않습니다.' });
    }

    await prisma.$transaction(async (tx) => {
      // 장착 해제
      const unequipCard = await tx.card.update({
        where: {
          slotNumber: inputCard.slotNumber,
          cardId: inputCard.cardId,
          userId: userId,
        },
        data: {
          state: INVENTORY,
        },
      });

      // 해당 슬롯 데이터 비워두기
      await tx.formations.delete({
        where: {
          formationId: prevformationCard.formationId,
          lineUp: lineUp,
          position: position,
          userId: userId,
          clubId: userClub.clubId,
        },
      });

      const updatedTeamTotalStat = subTotalStat(prevformationCard.teamTotalStat, position, unequipCard);

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

router.get('/check', async (req, res, next) => {
  try {
    const formations = await formationRepository.findManyFormation(req.user.userId);

    if (!formations) {
      return res.status(401).json({ message: '포메이션에 대한 정보가 없습니다.' });
    }

    const formationsA = [];
    const formationsB = [];
    for (const value of formations) {
      if (value.lineUp === LINEUP.A) {
        formationsA.push(value);
      } else if (value.lineUp === LINEUP.B) {
        formationsB.push(value);
      }
    }

    const msg = { LineUp_A: formationsA, LineUp_B: formationsB };
    return res.status(200).json(msg);
  } catch (error) {
    next(error);
  }
});

export default pathRouter;
