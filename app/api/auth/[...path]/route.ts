import { getAuth } from "@/lib/auth/server";
import { handleApiError } from "@/app/api/_lib/http";

export const dynamic = "force-dynamic";

async function handle(request: Request) {
  try { return await getAuth().handler(request); }
  catch (error) { return handleApiError(error); }
}

export const GET = handle;
export const POST = handle;
