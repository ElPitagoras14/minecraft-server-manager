import { FieldInfo } from "@/utils/interfaces";
import { z } from "zod";

export const fields: FieldInfo[] = [
  {
    name: "name",
    label: "Name",
    initValue: "",
    type: "text",
    validation: z.string().min(1, "Name is required"),
    create: true,
    update: false,
  },
  {
    name: "version",
    label: "Version",
    initValue: "",
    type: "autocomplete",
    validation: z.string().min(1, "Version is required"),
    create: true,
    update: false,
  },
  {
    name: "description",
    label: "Description",
    initValue: "A minecraft server",
    type: "text",
    validation: z.string().min(1, "Description is required"),
    create: true,
    update: false,
  },
  {
    name: "role",
    label: "Role",
    initValue: "",
    type: "text",
    validation: z.any(),
    create: false,
    update: true,
  },
];
