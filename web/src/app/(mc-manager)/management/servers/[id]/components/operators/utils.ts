import { FieldInfo } from "@/utils/interfaces";
import { z } from "zod";

export const fields: FieldInfo[] = [
  {
    name: "name",
    label: "Username",
    type: "text",
    initValue: "",
    validation: z.string().min(1, "Username is required"),
    create: true,
    update: false,
  },
];
