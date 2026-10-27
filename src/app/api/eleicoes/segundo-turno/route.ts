import electionApi from "../../../../services/election-api.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  return electionApi.fetch(request);
}

export async function POST(request: Request) {
  return electionApi.fetch(request);
}
