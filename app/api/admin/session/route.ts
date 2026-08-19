import { requireAdminRequest } from "@/app/admin-auth";
import { adminError } from "../_lib/admin-api";

export async function GET(request: Request) {
  try {
    return Response.json({ admin: await requireAdminRequest(request) });
  } catch (error) {
    return adminError(error);
  }
}
