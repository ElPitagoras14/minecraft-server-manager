"use client";

import { ErrorResponse } from "@/utils/interfaces";
import * as React from "react";

type ErrorDialogState = {
  response: ErrorResponse | null;
  open: boolean;
};

type Action =
  | { type: "SHOW_ERROR"; payload: Omit<ErrorDialogState, "open"> }
  | { type: "HIDE_ERROR" };

const initialState: ErrorDialogState = {
  response: null,
  open: false,
};

const reducer = (state: ErrorDialogState, action: Action): ErrorDialogState => {
  switch (action.type) {
    case "SHOW_ERROR":
      return {
        ...state,
        ...action.payload,
        open: true,
      };
    case "HIDE_ERROR":
      return {
        ...state,
        response: null,
        open: false,
      };
    default:
      return state;
  }
};

const ErrorDialogContext = React.createContext<{
  state: ErrorDialogState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export const ErrorDialogProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [state, dispatch] = React.useReducer(reducer, initialState);

  return (
    <ErrorDialogContext.Provider value={{ state, dispatch }}>
      {children}
    </ErrorDialogContext.Provider>
  );
};

export const useErrorDialog = () => {
  const context = React.useContext(ErrorDialogContext);
  if (!context) {
    throw new Error(
      "useErrorDialog must be used within an ErrorDialogProvider"
    );
  }
  const { state, dispatch } = context;

  const showError = (payload: Omit<ErrorDialogState, "open">) => {
    dispatch({ type: "SHOW_ERROR", payload });
  };

  const hideError = () => {
    dispatch({ type: "HIDE_ERROR" });
  };

  return { ...state, showError, hideError };
};