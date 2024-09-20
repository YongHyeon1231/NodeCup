import Joi from 'joi';

const equipSchema = Joi.object({
  cardNumber: Joi.number().integer().required(),
  lineUp: Joi.string().valid('A', 'B').required(),
  position: Joi.string().valid('forward', 'midfielder', 'defender', 'manager').required(),
}).unknown(true);

const unequipSchema = Joi.object({
  cardNumber: Joi.number().integer().required(),
  lineUp: Joi.string().valid('A', 'B').required(),
  position: Joi.string().valid('forward', 'midfielder', 'defender', 'manager').required(),
}).unknown(true);

const formationsValidationJoi = {
  equipCodeBodyValidation: async (req, res, next) => {
    try {
      const validation = await equipSchema.validateAsync(req.body);
      next();
    } catch (error) {
      next(error);
    }
  },
  unequipCodeBodyValidation: async (req, res, next) => {
    try {
      const validation = await unequipSchema.validateAsync(req.body);

      next();
    } catch (error) {
      next(error);
    }
  },
};

export default formationsValidationJoi;
