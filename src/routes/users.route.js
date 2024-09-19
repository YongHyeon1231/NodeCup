import express from 'express';
import { prisma } from '../lib/utils/prisma/index.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import uv from '../middlewares/validators/userValidator.middleware.js';
import au from '../middlewares/auths/user-auth.middleware.js';
import userValidatorJoi from '../middlewares/validators/userValidator.middleware.js';

const router = express.Router();

router.post('/users/sign-up', uv.signUpValidation, async (req, res, next) => {
  try {
    const { userName, email, password } = req.body;
    const isExistUser = await prisma.users.findFirst({
      where: {
        email,
      },
    });

    if (isExistUser) {
      return res.status(409).json({ message: '이미 존재하는 아이디입니다.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.users.create({
      data: {
        userName,
        email,
        password: hashedPassword,
      },
    });

    return res.status(201).json({ message: '회원가입 성공' });
  } catch (error) {
    next(error);
  }
});

router.post('/users/sign-in', uv.signInValidation, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.users.findFirst({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ message: '존재하지 않은 유저입니다.' });
    } else if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: '비밀번호가 일치하지 않습니다.' });
    }

    const token = jwt.sign(
      {
        userId: user.userId,
        userName: user.userName,
        email: email,
      },
      process.env.JWT_SECRET_KEY,
      {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRATION,
      },
    );

    res.header('authorization', `Bearer ${token}`);
    return res.status(200).json({ message: '로그인 성공' });
  } catch (error) {
    next(error);
  }
});

router.get('/users', au, async (req, res, next) => {
  const email = req.user.email;

  const user = await prisma.users.findFirst({
    where: { email: email },
    select: {
      userId: true,
      userName: true,
      email: true,
      password: true,
    },
  });

  return res.status(200).json({ data: user });
});

export default router;
