export const createUserSchema = {
  type: "object",
  properties: {
    body: {
      type: "object",
      properties: {
        id: { type: "string" },
        username: { type: "string" },
        email: { type: "string" },
      },
      required: ["id", "username", "email"],
    },
  },
};
