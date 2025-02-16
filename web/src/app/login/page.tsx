"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import {
  IconBrandGithub,
  IconCup,
  IconLocationStar,
} from "@tabler/icons-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { FieldInfo } from "@/utils/interfaces";
import { useRouter } from "next/navigation";
import CustomField from "@/components/form-fields/custom-field";
import { Icons } from "@/components/ui/icons";

const fields: FieldInfo[] = [
  {
    name: "username",
    initValue: "",
    label: "Username",
    placeholder: "funnybunny",
    type: "text",
    validation: z.string().min(1, "Username is required"),
    create: true,
    update: false,
  },
  {
    name: "password",
    initValue: "",
    label: "Password",
    placeholder: "**********",
    type: "password",
    validation: z.string().min(1, "Password is required"),
    create: true,
    update: false,
  },
];

const validationSchema = z.object(
  fields.reduce((acc: Record<string, z.ZodTypeAny>, field: FieldInfo) => {
    acc[field.name] = field.validation;
    return acc;
  }, {})
);

const initialValues = fields.reduce(
  (acc: Record<string, unknown>, field: FieldInfo) => {
    acc[field.name] = field.initValue;
    return acc;
  },
  {}
);

export default function LoginPage() {
  const { toast } = useToast();
  const router = useRouter();

  const [isLoadingLogin, setIsLoadingLogin] = useState(false);

  const form = useForm<z.infer<typeof validationSchema>>({
    resolver: zodResolver(validationSchema),
    defaultValues: initialValues,
  });

  const onSubmit = form.handleSubmit(async (data) => {
    setIsLoadingLogin(true);
    try {
      const response = await signIn("credentials", {
        username: data.username,
        password: data.password,
        redirect: false,
        redirectTo: "/",
      });
      console.log("response", response);
      if (!response || response.error) {
        toast({
          title: "Error logging in",
          description: "Please check your credentials and try again",
        });
      } else {
        router.push("/");
      }
    } catch (error: unknown) {
      console.error(error);
      toast({
        title: "Error logging in",
        description: "Please check your credentials and try again",
      });
    } finally {
      setIsLoadingLogin(false);
    }
  });

  return (
    <div className="flex min-w-full min-h-svh">
      <div className="bg-secondary w-[50%] hidden lg:block">
        <div className="flex flex-col justify-between min-h-svh px-8 py-8">
          <div className="flex space-x-4 items-center">
            <IconLocationStar className="w-8 h-8" />
            <p>Minecraft Server Manager</p>
          </div>
          <div className="flex space-x-4">
            <Link
              href={"https://github.com/ElPitagoras14"}
              className="flex items-center space-x-1 px-0"
            >
              <IconBrandGithub />
              <p className="text-sm">GitHub</p>
            </Link>
            <Link
              href={"https://www.buymeacoffee.com/jhonyg"}
              className="flex items-center space-x-1 px-0"
            >
              <IconCup />
              <p className="text-sm">Support</p>
            </Link>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center justify-between lg:justify-center w-[100%] lg:w-[50%] pt-8 pb-6">
        <div className="flex space-x-4 items-center w-[100%] px-6 lg:hidden">
          <IconLocationStar className="w-8 h-8" />
          <p>Minecraft Server Manager</p>
        </div>
        <div className="flex flex-col items-center justify-center w-[70%]">
          <p className="text-xl font-semibold">Login</p>
          <Form {...form}>
            <form
              className="flex flex-col space-y-2 w-[100%] lg:w-[20vw] justify-center"
              onSubmit={onSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onSubmit();
                }
              }}
            >
              {fields.map((field) => (
                <CustomField
                  key={field.name}
                  fieldInfo={field}
                  formContext={form}
                />
              ))}
              <div className="py-2"></div>
              <Button
                type="button"
                size="lg"
                disabled={
                  isLoadingLogin ||
                  !form.formState.isDirty ||
                  !form.formState.isValid
                }
                onClick={onSubmit}
              >
                {isLoadingLogin ? (
                  <Icons.spinner className="h-6 w-6 animate-spin" />
                ) : (
                  "Login"
                )}
              </Button>
            </form>
          </Form>
        </div>
        <div className="flex space-x-4 w-[100%] justify-center lg:hidden">
          <Link
            href={"https://github.com/ElPitagoras14"}
            className="flex items-center space-x-1 px-0"
          >
            <IconBrandGithub />
            <p className="text-sm">GitHub</p>
          </Link>
          <Link
            href={"https://www.buymeacoffee.com/jhonyg"}
            className="flex items-center space-x-1 px-0"
          >
            <IconCup />
            <p className="text-sm">Support</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
