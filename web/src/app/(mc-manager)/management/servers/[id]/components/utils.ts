import { FieldInfo } from "@/utils/interfaces";
import { z } from "zod";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const startServer = async (
  id: string,
  token: string,
  requesterId: string
): Promise<void> => {
  const dataOptions = {
    url: `${API_URL}/server/start/${id}`,
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      requesterId,
      requesterRoles: [],
    },
  };

  await axios.request(dataOptions);
};

export const stopServer = async (
  id: string,
  token: string,
  requesterId: string
): Promise<void> => {
  const dataOptions = {
    url: `${API_URL}/server/stop/${id}`,
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      requesterId,
      requesterRoles: [],
    },
  };

  await axios.request(dataOptions);
};

export const restartServer = async (
  id: string,
  token: string,
  requesterId: string
): Promise<void> => {
  const dataOptions = {
    url: `${API_URL}/server/restart/${id}`,
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      requesterId,
      requesterRoles: [],
    },
  };

  await axios.request(dataOptions);
};

export const propertyFields: FieldInfo[] = [
  {
    name: "motd",
    label: "Description",
    initValue: "A minecraft server",
    type: "text",
    validation: z.string().min(1, "Description is required"),
    create: true,
    update: true,
  },
  {
    name: "difficulty",
    label: "Difficulty",
    initValue: "normal",
    type: "select",
    options: [
      { label: "Peaceful", value: "peaceful" },
      { label: "Easy", value: "easy" },
      { label: "Normal", value: "normal" },
      { label: "Hard", value: "hard" },
    ],
    validation: z.enum(["peaceful", "easy", "normal", "hard"]),
    create: true,
    update: true,
  },
  {
    name: "serverIcon",
    label: "Server Icon URL",
    initValue: "",
    type: "text",
    validation: z.string().url().optional().or(z.literal("")),
    create: true,
    update: false,
  },
  {
    name: "maxPlayers",
    label: "Max Players",
    initValue: "8",
    type: "text",
    validation: z.string().refine(
      (value) => {
        const num = parseInt(value);
        return num >= 2 && num <= 20;
      },
      {
        message: "Max players must be between 2 and 20",
      }
    ),
    create: true,
    update: true,
  },
  {
    name: "viewDistance",
    label: "View Distance",
    initValue: "12",
    type: "text",
    validation: z.string().refine(
      (value) => {
        const num = parseInt(value);
        return num >= 10 && num <= 16;
      },
      {
        message: "View distance must be between 10 and 16",
      }
    ),
    create: true,
    update: true,
  },
];

export const serverFields: FieldInfo[] = [
  {
    name: "roleName",
    label: "Role",
    initValue: "",
    type: "text",
    validation: z.any(),
    create: false,
    update: true,
  },
];
