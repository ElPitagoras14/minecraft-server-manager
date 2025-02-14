export const loginSchema = {
  type: "object",
  properties: {
    body: {
      type: "object",
      properties: {
        username: { type: "string" },
        password: { type: "string" },
      },
      required: ["username", "password"],
    },
  },
  required: ["body"],
  additionalProperties: true,
};
