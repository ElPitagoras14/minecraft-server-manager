"use client";

import { z } from "zod";
import axios, { isAxiosError } from "axios";
import { ErrorResponse, FieldInfo } from "@/utils/interfaces";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import CustomField from "@/components/form-fields/custom-field";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import {
  propertyFields,
  restartServer,
  serverFields,
  startServer,
  stopServer,
  deleteServer,
} from "./utils";
import { useSession } from "next-auth/react";
import { useErrorDialog } from "@/hooks/use-error-dialog";
import { toast } from "@/hooks/use-toast";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import LoadableIcon from "@/components/loadable-icon";
import {
  Clipboard,
  ClipboardCheck,
  CloudDownload,
  Play,
  RotateCcw,
  Square,
  Trash,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const propertyUpdateFields = propertyFields.filter((field) => field.update);

const propertyValidationSchema = z.object(
  propertyUpdateFields.reduce(
    (acc: Record<string, z.ZodTypeAny>, field: FieldInfo) => {
      acc[field.name] = field.validation;
      return acc;
    },
    {}
  )
);

const serverValidationSchema = z.object(
  serverFields.reduce((acc: Record<string, z.ZodTypeAny>, field: FieldInfo) => {
    acc[field.name] = field.validation;
    return acc;
  }, {})
);

const getProperties = async (serverId: string, token: string) => {
  const dataOptions = {
    method: "GET",
    url: `${API_URL}/servers/${serverId}/properties`,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const response = await axios.request(dataOptions);
  const {
    data: { payload },
  } = response;

  return payload;
};

const getData = async (serverId: string, token: string) => {
  const dataOptions = {
    method: "GET",
    url: `${API_URL}/servers/${serverId}`,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const response = await axios.request(dataOptions);
  const {
    data: { payload },
  } = response;

  return payload;
};

const updateRole = async (
  serverId: string,
  token: string,
  requesterId: string,
  requesterUser: string,
  data: z.infer<typeof serverValidationSchema>
) => {
  const dataOptions = {
    method: "PUT",
    url: `${API_URL}/servers/${serverId}`,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      requesterId,
      requesterUser,
      ...data,
    },
  };

  await axios.request(dataOptions);
};

const updateProperties = async (
  serverId: string,
  token: string,
  requesterId: string,
  requesterUser: string,
  data: z.infer<typeof propertyValidationSchema>
) => {
  const dataOptions = {
    method: "PUT",
    url: `${API_URL}/servers/${serverId}/properties`,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      requesterId,
      requesterUser,
      properties: data,
    },
  };

  await axios.request(dataOptions);
};

const propertyMap = {
  "level-name": "serverName",
  "max-players": "maxPlayers",
  "view-distance": "viewDistance",
  motd: "motd",
  difficulty: "difficulty",
  version: "version",
};

export default function GeneralTab() {
  const { data: session } = useSession();
  const { user: { token = "", id: userId = "", username = "" } = {} } =
    session || {};

  const { id } = useParams();
  const { showError } = useErrorDialog();
  const router = useRouter();

  const [data, setData] = useState<Record<string, string>>();
  const { name, version, status, port, containerId } = data || {};
  const [properties, setProperties] = useState<Record<string, unknown>>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingRole, setIsLoadingRole] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const serverInitialValues = serverFields.reduce(
    (acc: Record<string, unknown>, field: FieldInfo) => {
      acc[field.name] = field.initValue;
      return acc;
    },
    {}
  );

  const propertyInitialValues = propertyUpdateFields.reduce(
    (acc: Record<string, unknown>, field: FieldInfo) => {
      acc[field.name] = field.initValue;
      return acc;
    },
    {}
  );

  const propertyForm = useForm<z.infer<typeof propertyValidationSchema>>({
    defaultValues: propertyInitialValues,
    resolver: zodResolver(propertyValidationSchema),
    mode: "onChange",
  });

  const serverForm = useForm<z.infer<typeof serverValidationSchema>>({
    defaultValues: serverInitialValues,
    resolver: zodResolver(serverValidationSchema),
    mode: "onChange",
  });

  const handleErrorResponse = (error: unknown) => {
    if (isAxiosError(error)) {
      const { response: { data, status } = {} } = error;
      if (status === 401) {
        const { detail } = data;
        toast({
          variant: "destructive",
          title: detail,
        });
        return;
      } else if (data.statusCode === 404) {
        toast({
          title: "No data found",
        });
        setData({});
        return;
      }
      showError({
        response: data as ErrorResponse,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Unknown error",
      });
    }
  };

  const loadData = async () => {
    try {
      const data = await getData(id as string, token);
      setData(data);
      const properties = await getProperties(id as string, token);
      setProperties(properties);
    } catch (error: unknown) {
      handleErrorResponse(error);
    }
  };

  const handleStartServer = async (id: string, name: string) => {
    try {
      await startServer(id, token, userId, username);
      await loadData();
      toast({
        title: `Server ${name} started`,
      });
    } catch (error: unknown) {
      handleErrorResponse(error);
    } finally {
    }
  };

  const handleStopServer = async (id: string, name: string) => {
    try {
      await stopServer(id, token, userId, username);
      await loadData();
      toast({
        title: `Server ${name} stopped`,
      });
    } catch (error: unknown) {
      handleErrorResponse(error);
    }
  };

  const handleRestartServer = async (id: string, name: string) => {
    try {
      await restartServer(id, token, userId, username);
      await loadData();
      toast({
        title: `Server ${name} restarted`,
      });
    } catch (error: unknown) {
      handleErrorResponse(error);
    }
  };

  const handleDeleteServer = async (id: string, name: string) => {
    try {
      await deleteServer(id, token, userId, username);
      router.push("/management/servers");
      toast({
        title: `Server ${name} deleted`,
      });
    } catch (error: unknown) {
      handleErrorResponse(error);
    }
  };

  const onSubmitServer = serverForm.handleSubmit(
    async (data: z.infer<typeof serverValidationSchema>) => {
      try {
        setIsLoadingRole(true);
        await updateRole(id as string, token, userId, username, data);
        await loadData();
        toast({
          title: "Server updated",
        });
      } catch (error: unknown) {
        handleErrorResponse(error);
      } finally {
        setIsLoadingRole(false);
      }
    }
  );

  const onSubmitProperties = propertyForm.handleSubmit(
    async (data: z.infer<typeof propertyValidationSchema>) => {
      try {
        setIsLoading(true);
        await updateProperties(id as string, token, userId, username, data);
        await loadData();
        toast({
          title: "Properties updated",
        });
      } catch (error: unknown) {
        handleErrorResponse(error);
      } finally {
        setIsLoading(false);
      }
    }
  );

  useEffect(() => {
    if (!properties) return;
    const newInitialValues = Object.entries(properties).reduce(
      (acc: Record<string, unknown>, [key, value]) => {
        if (Object.hasOwn(propertyMap, key)) {
          acc[propertyMap[key as keyof typeof propertyMap]] = `${value}`;
        }
        return acc;
      },
      {}
    );
    newInitialValues.version = version;
    propertyForm.reset(newInitialValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties, data]);

  useEffect(() => {
    if (!data) return;
    const newInitialValues = {
      ...data,
    };
    serverForm.reset(newInitialValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    if (!token || !id) return;
    (async () => {
      await loadData();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex justify-between">
        <div className="flex flex-col space-y-1">
          <div className="flex flex-row space-x-6 items-center">
            <p className="text-lg font-semibold">Server {name}</p>
            <TooltipProvider>
              <div className="flex flex-row items-center space-x-2 pt-2">
                <Tooltip>
                  <TooltipTrigger>
                    <CloudDownload
                      className="h-5 w-5 hover:cursor-pointer hover:text-primary"
                      onClick={loadData}
                    />
                  </TooltipTrigger>
                  <TooltipContent>Refresh</TooltipContent>
                </Tooltip>
                {status === "RUNNING" && (
                  <Tooltip>
                    <TooltipTrigger>
                      <LoadableIcon
                        icon={
                          <Square className="h-5 w-5 hover:cursor-pointer hover:text-primary" />
                        }
                        func={async () => handleStopServer(id as string, name)}
                      />
                    </TooltipTrigger>
                    <TooltipContent>Stop</TooltipContent>
                  </Tooltip>
                )}
                {status === "STOPPED" && (
                  <Tooltip>
                    <TooltipTrigger>
                      <LoadableIcon
                        icon={
                          <Play className="h-5 w-5 hover:cursor-pointer hover:text-primary" />
                        }
                        func={async () => handleStartServer(id as string, name)}
                      />
                    </TooltipTrigger>
                    <TooltipContent>Start</TooltipContent>
                  </Tooltip>
                )}
                {status === "STARTING" && (
                  <Icons.spinner className="animate-spin h-5 w-5" />
                )}
                <Tooltip>
                  <TooltipTrigger>
                    <RotateCcw
                      onClick={async () =>
                        handleRestartServer(id as string, name)
                      }
                      className="h-5 w-5 hover:cursor-pointer hover:text-primary"
                    />
                  </TooltipTrigger>
                  <TooltipContent>Restart</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger>
                    <LoadableIcon
                      icon={
                        <Trash className="h-5 w-5 hover:cursor-pointer hover:text-primary" />
                      }
                      func={async () => handleDeleteServer(id as string, name)}
                    />
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
          <div className="text-muted-foreground text-sm">
            ID: <span className="text-accent-foreground">{id}</span>
            <br />
            Version: <span className="text-accent-foreground">{version}</span>
            <br />
            Status: <span className="text-accent-foreground">{status}</span>
            <br />
            Port: <span className="text-accent-foreground">{port}</span>
            <br />
            <div className="flex flex-row space-x-2 items-center">
              <span>
                Container ID:{" "}
                <span className="text-accent-foreground">{containerId}</span>
              </span>
              {isCopied ? (
                <ClipboardCheck className="h-5 w-5 text-primary" />
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Clipboard
                        className="h-5 w-5 text-accent-foreground hover:cursor-pointer hover:text-primary"
                        onClick={async () => {
                          await navigator.clipboard.writeText(containerId);
                          toast({
                            title: "Container ID copied to clipboard",
                          })
                          setIsCopied(true);
                          setTimeout(() => {
                            setIsCopied(false);
                          }, 1000);
                        }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>Copy ID</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </div>
        <Form {...serverForm}>
          <form className="flex flex-row items-center space-x-2 mt-2">
            <div className="flex flex-row items-end">
              {serverFields.map((field) => (
                <CustomField
                  key={field.name}
                  formContext={serverForm}
                  fieldInfo={field}
                />
              ))}
              <Button
                className="ml-4"
                type="button"
                onClick={onSubmitServer}
                disabled={
                  !serverForm.formState.isDirty && serverForm.formState.isValid
                }
              >
                {isLoadingRole && (
                  <Icons.spinner className="animate-spin mr-1 h-11" />
                )}
                Update Role
              </Button>
            </div>
          </form>
        </Form>
      </div>
      <Form {...propertyForm}>
        <form className="mt-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 pb-4">
            {propertyUpdateFields.map((field) => (
              <CustomField
                key={field.name}
                formContext={propertyForm}
                fieldInfo={field}
              />
            ))}
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={
                !propertyForm.formState.isDirty ||
                isLoading ||
                status === "STARTING"
              }
              onClick={onSubmitProperties}
            >
              {isLoading && (
                <Icons.spinner className="animate-spin mr-1 h-11" />
              )}
              Restart and Apply
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
