import express from 'express';
import { prisma } from '../lib/utils/prisma/index.js';
import au from '../middlewares/auths/user-auth.middleware.js';

const router = express.Router();

// 게임플레이 API
router.post('/gameplay', au, async (req, res, next) => {
  const { lineUp } = req.body;

  try {
    // 유저의 포메이션 조회
    const userFormations = await prisma.formations.findMany({
      where: { userId: req.user.userId },
    });

    if (userFormations.length === 0) {
      return res.status(404).json({ message: '포메이션을 찾을 수 없습니다.' });
    }

    // 내가 선택한 라인업의 포메이션 찾기
    const userFormation = userFormations.find((formation) => formation.lineUp === lineUp);

    if (!userFormation) {
      return res.status(404).json({ message: '선택한 라인업의 포메이션을 찾을 수 없습니다.' });
    }

    const userTotalStat = userFormation.teamTotalStat;

    // 상대 유저 랜덤 선택
    const opponent = await prisma.users.findMany({ where: { NOT: { userId: req.user.userId } } });
    const randomOpponent = opponent[Math.floor(Math.random() * opponent.length)];

    // 상대 포메이션 조회
    const opponentFormations = await prisma.formations.findMany({
      where: { userId: randomOpponent.userId },
    });

    if (opponentFormations.length === 0) {
      return res.status(404).json({ message: '상대 포메이션을 찾을 수 없습니다.' });
    }

    // 랜덤하게 상대 포메이션 선택
    const opponentFormation =
      opponentFormations[Math.floor(Math.random() * opponentFormations.length)];
    const opponentTotalStat = opponentFormation.teamTotalStat;

    // 스탯에 따른 점수 계산
    const statDifference = userTotalStat - opponentTotalStat;
    const baseScore = Math.floor(Math.random() * 3) + 1; // 기본 점수는 1~3
    let userScore = baseScore;
    let opponentScore = baseScore;

    // 스탯 차이로 인한 점수 증가
    if (statDifference > 0) {
      // 스탯 차이가 10 이상 일 때 내 점수 추가
      userScore += Math.floor(statDifference / 10);
    } else {
      // 상대방의 스탯이 높을 경우 상대 점수 증가
      opponentScore += Math.floor(-statDifference / 10);
    }

    // 최종 점수는 최소 1점에서 최대 5점으로 제한
    userScore = Math.min(Math.max(userScore, 1), 5);
    opponentScore = Math.min(Math.max(opponentScore, 1), 5);

    // 동점 방지 (동점일 경우 점수 조정)
    if (userScore === opponentScore) {
      if (Math.random() > 0.5) {
        userScore++; // 내 점수 증가
      } else {
        opponentScore++; // 상대방 점수 증가
      }

      // 최종 점수는 여전히 5점을 넘지 않도록 제한
      userScore = Math.min(userScore, 5);
      opponentScore = Math.min(opponentScore, 5);
    }

    let result;
    let mmrChange = 10; // 기본 MMR 변화량
    const userClub = await prisma.club.findUnique({ where: { userId: req.user.userId } });
    const opponentClub = await prisma.club.findUnique({ where: { userId: randomOpponent.userId } });

    let earnedGold, mmrChangeAmount;

    if (userScore > opponentScore) {
      result = `${userClub.clubName}님이 승리하였습니다! 스코어 ${userScore} - ${opponentScore} 로 이겼습니다!`;
      earnedGold = 10000;
      mmrChangeAmount = userClub.win > 0 ? mmrChange + 5 : mmrChange;

      await prisma.club.update({
        where: { userId: req.user.userId },
        data: {
          win: { increment: 1 },
          gold: { increment: earnedGold },
          MMR: { increment: mmrChangeAmount },
        },
      });
      await prisma.club.update({
        where: { userId: randomOpponent.userId },
        data: {
          lose: { increment: 1 },
          gold: { increment: 5000 },
          MMR: { decrement: opponentClub.lose > 0 ? mmrChange + 5 : mmrChange },
        },
      });

      result += ` ${earnedGold} 골드를 획득하였습니다! MMR이 ${mmrChangeAmount} 상승하였습니다!`;
    } else {
      result = `${opponentClub.clubName}님이 승리하였습니다! 스코어 ${userScore} - ${opponentScore} 로 이겼습니다!`;
      earnedGold = 5000;
      mmrChangeAmount = userClub.lose > 0 ? mmrChange + 5 : mmrChange;

      await prisma.club.update({
        where: { userId: req.user.userId },
        data: {
          lose: { increment: 1 },
          gold: { increment: earnedGold },
          MMR: { decrement: mmrChangeAmount },
        },
      });
      await prisma.club.update({
        where: { userId: randomOpponent.userId },
        data: {
          win: { increment: 1 },
          gold: { increment: 10000 },
          MMR: { increment: opponentClub.win > 0 ? mmrChange + 5 : mmrChange },
        },
      });

      result += ` ${earnedGold} 골드를 획득하였습니다. MMR이 ${mmrChangeAmount} 감소하였습니다.`;
    }

    return res.status(200).json({
      message: result,
      opponent: opponentClub.clubName,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
