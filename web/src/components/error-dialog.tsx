"use client";

import { X, Copy } from "lucide-react";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { useErrorDialog } from "../hooks/use-error-dialog";

const statusCodeMap: Record<number, string> = {
  404: "No encontrado",
  409: "Conflicto",
  500: "Error interno del servidor",
};

export default function ErrorDialog() {
  const { response, open, hideError } = useErrorDialog();

  if (!open || !response) return null;

  const { message, statusCode, requestId } = response;

  return (
    <AlertDialog open={open} onOpenChange={hideError}>
      <AlertDialogContent className="bg-destructive text-destructive-foreground border-destructive">
        <AlertDialogHeader>
          <div className="flex items-center justify-between">
            <AlertDialogTitle>{statusCodeMap[statusCode!]}</AlertDialogTitle>
            <Button variant="ghost" size="icon" onClick={hideError}>
              <X />
            </Button>
          </div>
        </AlertDialogHeader>
        <div className="flex flex-row items-center justify-between">
          <ul className="ml-6 list-disc [&>li:not(:first-child)]:mt-2">
            <li>Petición: {requestId}</li>
            <li>Código: {statusCode}</li>
            <li>Mensaje: {message}</li>
          </ul>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `Error: ${message}\nCódigo: ${statusCode}\nPetición: ${requestId}`
                    );
                  }}
                >
                  <Copy />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copiar al portapapeles</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
