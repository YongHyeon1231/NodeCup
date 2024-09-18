import Joi from 'joi';

const signUpSchema = Joi.object({
  userName: Joi.string().lowercase().min(2).max(10).required(),
  email: Joi.string().email({ minDomainSegments: 2, tlds: { allow: ['com'] } }),
  password: Joi.string().min(6).max(20).required(),
});

const signInSchema = Joi.object({
  email: Joi.string().email({ minDomainSegments: 2, tlds: { allow: ['com'] } }),
  password: Joi.string().min(6).max(20).required(),
});

const userValidatorJoi = {
  signUpValidation: async (req, res, next) => {
    const validation = await signUpSchema.validateAsync(req.body);

    if (validation.error) {
      console.log(req.originalUrl, '회원가입 인증 실패');
      let msg = { message: '회원가입 입력된 값이 잘못되었습니다.' };
      return res.status(400).json(msg);
    }
    next();
  },
  signInValidation: async (req, res, next) => {
    const validation = await signInSchema.validateAsync(req.body);

    if (validation.error) {
      console.log(req.originalUrl, '로그인 인증 실패');
      let msg = { message: '입력된 값이 잘못되었습니다.' };
      return res.status(400).json(msg);
    }
    next();
  },
};

export default userValidatorJoi;
