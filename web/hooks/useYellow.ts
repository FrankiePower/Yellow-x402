"use client";

import { useContext } from "react";
import { YellowNetworkContext } from "../context";

export const useYellow = () => {
  const context = useContext(YellowNetworkContext);
  if (!context) {
    throw new Error("useYellow must be used within a YellowNetworkProvider");
  }
  return context;
};
