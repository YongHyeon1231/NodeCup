import express from 'express';
import dotenv from 'dotenv';

import usersRouter from './routes/users.route.js';
import shopRouter from './routes/shop.route.js';
import cardRouter from './routes/card.route.js';
import cardModelRouter from './routes/cardModel.route.js';
import upgrading from './routes/upgrade.route.js';

import ErrorHandlingMiddleware from './middlewares/error-handling.middleware.js';

import clubrouter from './routes/club.route.js';

// .env 파일을 읽어서 process.env에 추가합니다.
dotenv.config();

const app = express();
const PORT = process.env.DATABASE_PORT;

app.use(express.json()); // body parser 역할

app.use('/api', [usersRouter, clubrouter, shopRouter, cardRouter, cardModelRouter, upgrading]);

app.use(ErrorHandlingMiddleware);

app.listen(PORT, () => {
  console.log(PORT, '포트로 서버가 열렸습니다.');
});
