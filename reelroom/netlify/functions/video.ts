import type { Config } from "@netlify/functions";
import { handleVideo } from "../../shared/http.ts";

export default function video(req: Request) {
  return handleVideo(req);
}

export const config: Config = {
  path: "/api/video",
  method: "POST",
};
