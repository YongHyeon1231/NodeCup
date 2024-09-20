import express from 'express';
import { prisma } from '../lib/utils/prisma/index.js';
import jwt from 'jsonwebtoken';
import au from '../middlewares/auths/user-auth.middleware.js';

const router = express.Router();

//클럽생성 api
router.post('/club', au, async (req, res, next) => {
  try {
    const { clubName } = req.body;
    const { userId } = req.user;

    if (clubName.length < 2 || clubName.length > 10) {
      return res.status(400).json({
        message: `해당 클럽명(${clubName})은 사용하실 수 없습니다 (클럽명은 2글자 이상, 10글자 이하여야 합니다)`,
      });
    }

    const findClub = await prisma.club.findFirst({
      where: { userId },
    });

    if (findClub) {
      return res.status(409).json({
        message: `이미 보유중인 클럽이 존재합니다  (계정당 클럽소유갯수 1개로 제한)`,
      });
    }

    const findClubName = await prisma.club.findFirst({
      where: { clubName },
    });

    if (findClubName) {
      return res.status(409).json({ message: '이미 사용중인 클럽이름 입니다' });
    }

    await prisma.club.create({
      data: {
        userId: req.user.userId,
        clubName,
      },
    });
    return res.status(200).json({ message: '클럽생성에 성공하였습니다' });
  } catch (error) {
    next(error);
  }
});

//클럽조회 api
router.get('/club/:clubName', async (req, res, next) => {
  try {
    const { clubName } = req.params;
    const { authorization } = req.headers;
    let email;

    try {
      const [tokenType, token] = authorization.split(' ');

      const decodedtoken = jwt.verify(token, process.env.JWT_SECRET_KEY);
      email = decodedtoken.email;
    } catch (err) {
      email = null;
    }

    const searchClub = await prisma.club.findFirst({
      where: { clubName },
      select: {
        clubName: true,
        MMR: true,
        gold: true,
        cash: true,
        win: true,
        lose: true,
        users: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!searchClub) {
      return res.status(401).json({ message: '존재하지 않는 클럽명입니다' });
    }

    let ClubInfo = {};

    if (searchClub.users.email === email) {
      ClubInfo = {
        clubName: searchClub.clubName,
        MMR: searchClub.MMR,
        record: searchClub.record,
        win: searchClub.win,
        lose: searchClub.lose,
        gold: searchClub.gold,
        cash: searchClub.cash,
      };
    }

    if (searchClub.users.email !== email) {
      ClubInfo = {
        clubName: searchClub.clubName,
        MMR: searchClub.MMR,
        record: searchClub.record,
        win: searchClub.win,
        lose: searchClub.lose,
      };
    }
    return res.status(200).json({ data: ClubInfo });
  } catch (error) {
    next(error);
  }
});

router.delete('/club', au, async (req, res, next) => {
  try {
    const { userId } = req.user;

    const findClub = await prisma.club.findFirst({
        where : {userId}
    })

    if(!findClub){
        return res.status(401).json({message:`해당 클럽이 존재하지 않습니다`})
    }
    await prisma.club.delete({
      where: { userId },
    });
    return res.status(400).json({ message: '클럽삭제가 정상처리 되었습니다' });
  } catch (error) {
    next(error);
  }
});

export default router;
