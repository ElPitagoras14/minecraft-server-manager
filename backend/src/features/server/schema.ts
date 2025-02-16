export const getAllServerSchema = {
  type: "object",
  properties: {
    query: {
      type: "object",
      properties: {
        requesterId: { type: "string" },
        requesterRoles: { type: "array", items: { type: "string" } },
      },
    },
  },
};

export const createServerSchema = {
  type: "object",
  properties: {
    body: {
      type: "object",
      properties: {
        requesterId: { type: "string" },
        serverProperties: {
          type: "object",
          properties: {
            motd: { type: "string" },
            difficulty: { type: "string" },
            serverIcon: { type: "string" },
            maxPlayers: { type: "number", minimum: 2, maximum: 20 },
            viewDistance: { type: "number", minimum: 10, maximum: 16 },
            serverName: { type: "string" },
            version: { type: "string" },
          },
        },
      },
      required: ["requesterId", "requesterUser"],
    },
  },
};

export const getServerInfoSchema = {
  type: "object",
  properties: {
    params: {
      type: "object",
      properties: {
        serverId: { type: "number" },
      },
      required: ["serverId"],
    },
  },
};

export const updateServerInfoSchema = {
  type: "object",
  properties: {
    params: {
      type: "object",
      properties: {
        serverId: { type: "number" },
      },
      required: ["serverId"],
    },
    body: {
      type: "object",
      properties: {
        roleName: { type: "string" },
        requesterId: { type: "string" },
        requesterUser: { type: "string" },
      },
      required: ["roleName", "requesterId", "requesterUser"],
    },
  },
};

export const deleteServerSchema = {
  type: "object",
  properties: {
    params: {
      type: "object",
      properties: {
        serverId: { type: "number" },
      },
      required: ["serverId"],
    },
    body: {
      type: "object",
      properties: {
        requesterId: { type: "string" },
        requesterUser: { type: "string" },
      },
      required: ["requesterId", "requesterUser"],
    },
  },
};

export const startServerSchema = {
  type: "object",
  properties: {
    params: {
      type: "object",
      properties: {
        serverId: { type: "number" },
      },
      required: ["serverId"],
    },
    body: {
      type: "object",
      properties: {
        requesterId: { type: "string" },
        requesterUser: { type: "string" },
        requesterRoles: { type: "array", items: { type: "string" } },
      },
      required: ["requesterId", "requesterUser"],
    },
  },
};

export const stopServerSchema = {
  type: "object",
  properties: {
    params: {
      type: "object",
      properties: {
        serverId: { type: "number" },
      },
      required: ["serverId"],
    },
    body: {
      type: "object",
      properties: {
        requesterId: { type: "string" },
        requesterUser: { type: "string" },
        requesterRoles: { type: "array", items: { type: "string" } },
      },
      required: ["requesterId", "requesterUser"],
    },
  },
};

export const restartServerSchema = {
  type: "object",
  properties: {
    params: {
      type: "object",
      properties: {
        serverId: { type: "number" },
      },
      required: ["serverId"],
    },
    body: {
      type: "object",
      properties: {
        requesterId: { type: "string" },
        requesterUser: { type: "string" },
        requesterRoles: { type: "array", items: { type: "string" } },
      },
      required: ["requesterId", "requesterUser"],
    },
  },
};
