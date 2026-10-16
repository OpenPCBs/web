import { getBindings, getDb } from "../../db";
import { createTraceAuth } from "./factory";
import { authCapabilities } from "./config";

export function getAuth() {
  return createTraceAuth(getDb(), getBindings());
}

export function getAuthCapabilities() {
  return authCapabilities(getBindings());
}
