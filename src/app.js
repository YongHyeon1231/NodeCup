import express from 'express';
import dotenv from 'dotenv';

import usersRouter from './routes/users.route.js';

import ErrorHandlingMiddleware from './middlewares/error-handling.middleware.js';

// .env 파일을 읽어서 process.env에 추가합니다.
dotenv.config();

const app = express();
const PORT = process.env.DATABASE_PORT;

app.use(express.json()); // body parser 역할

app.use('/api', [usersRouter]);

app.use(ErrorHandlingMiddleware);

app.listen(PORT, () => {
    console.log(PORT, '포트로 서버가 열렸습니다.');
});
