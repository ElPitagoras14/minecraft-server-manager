import Ajv from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true, coerceTypes: true });
addFormats(ajv);

export const schemaValidator = (schema: any) => {
  return (req: any, res: any, next: any) => {
    const validate = ajv.compile(schema);
    const valid = validate(req);
    if (!valid) {
      res.status(400).json({
        message: "Validation error",
        errors: validate.errors,
      });
      return;
    }
    next();
  };
};
