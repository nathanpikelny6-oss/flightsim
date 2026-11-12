import type { Config } from "@netlify/functions";
import { handlePlan } from "../../shared/http.ts";

export default function plan(req: Request) {
  return handlePlan(req);
}

export const config: Config = {
  path: "/api/plan",
  method: "POST",
};
